from __future__ import annotations

from api.chat_service import ConversationRuntimeService
from api.dependencies import get_chat_runtime, get_db_session, session_scope
from api.route_helpers import chunk_text, serialize_conversation, sse_event
from api.schemas import ChatMessageRead, ChatTurnResponse, ConversationRead, MessageCreate
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from infra.db.chat_models import ChatMessage, Conversation
from sqlalchemy import select
from sqlalchemy.orm import Session


router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("/{conversation_id}", response_model=ConversationRead)
def get_conversation(conversation_id: str, session: Session = Depends(get_db_session)) -> ConversationRead:
    conversation = session.get(Conversation, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return serialize_conversation(session, conversation)


@router.get("/{conversation_id}/messages", response_model=list[ChatMessageRead])
def list_conversation_messages(
    conversation_id: str,
    session: Session = Depends(get_db_session),
) -> list[ChatMessage]:
    conversation = session.get(Conversation, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    query = (
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
    )
    return list(session.scalars(query).all())


@router.post("/{conversation_id}/messages", response_model=ChatTurnResponse)
def create_message(
    conversation_id: str,
    payload: MessageCreate,
    session: Session = Depends(get_db_session),
    chat_runtime: ConversationRuntimeService = Depends(get_chat_runtime),
) -> ChatTurnResponse:
    conversation = session.get(Conversation, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    try:
        turn = chat_runtime.process_user_message(session, conversation, payload.content)
    except ValueError as exc:
        session.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail="The assistant could not process the message.") from exc

    return ChatTurnResponse(
        conversation_id=conversation_id,
        user_message=ChatMessageRead.model_validate(turn.user_message),
        assistant_message=ChatMessageRead.model_validate(turn.assistant_message),
    )


@router.post("/{conversation_id}/messages/stream")
def stream_message(
    conversation_id: str,
    payload: MessageCreate,
    request: Request,
) -> StreamingResponse:
    chat_runtime: ConversationRuntimeService = request.app.state.chat_runtime

    def event_stream():
        yield sse_event("status", {"stage": "accepted"})
        with session_scope() as session:
            conversation = session.get(Conversation, conversation_id)
            if conversation is None:
                yield sse_event("error", {"detail": "Conversation not found."})
                return

            try:
                turn = chat_runtime.process_user_message(session, conversation, payload.content)
            except ValueError as exc:
                session.rollback()
                yield sse_event("error", {"detail": str(exc)})
                return
            except Exception:
                session.rollback()
                yield sse_event("error", {"detail": "The assistant could not process the message."})
                return

            yield sse_event(
                "message",
                {
                    "role": "user",
                    "message_id": turn.user_message.id,
                    "content": turn.user_message.content,
                },
            )
            yield sse_event("status", {"stage": "streaming_response"})
            for chunk in chunk_text(turn.assistant_message.content):
                yield sse_event("chunk", {"content": chunk})

            yield sse_event(
                "done",
                ChatTurnResponse(
                    conversation_id=conversation_id,
                    user_message=ChatMessageRead.model_validate(turn.user_message),
                    assistant_message=ChatMessageRead.model_validate(turn.assistant_message),
                ).model_dump(mode="json"),
            )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

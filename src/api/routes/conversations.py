from __future__ import annotations

import base64
from pathlib import Path

from api.dependencies import (
    get_chat_runtime,
    get_conversation_service,
    get_current_user,
    get_db_session,
    session_scope,
)
from api.route_helpers import chunk_text, sse_event
from api.schemas import (
    ChatMessageRead,
    ChatTurnResponse,
    ConversationRead,
    ConversationOrderUpdate,
    ConversationSearchPreferencesUpdate,
    ConversationStylePreferencesUpdate,
    ConversationUpdate,
    MessageImageAttachment,
    MessageCreate,
)
from core.settings import settings
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from infra.db.models.chat_models import ChatUser
from services.conversation_service import ConversationService
from services.conversation_runtime_service import ConversationRuntimeService
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/conversations", tags=["conversations"])

ALLOWED_IMAGE_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


@router.put("/order", response_model=list[ConversationRead])
async def reorder_conversations(
    payload: ConversationOrderUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user: ChatUser = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
) -> list[ConversationRead]:
    return await conversation_service.reorder_conversations(
        session,
        current_user.id,
        payload,
    )


@router.get("/{conversation_id}", response_model=ConversationRead)
async def get_conversation(
    conversation_id: str,
    session: AsyncSession = Depends(get_db_session),
    current_user: ChatUser = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
) -> ConversationRead:
    return await conversation_service.get_conversation(session, current_user.id, conversation_id)


@router.patch("/{conversation_id}", response_model=ConversationRead)
async def update_conversation(
    conversation_id: str,
    payload: ConversationUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user: ChatUser = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
) -> ConversationRead:
    return await conversation_service.update_conversation(
        session,
        current_user.id,
        conversation_id,
        payload,
    )


@router.get("/{conversation_id}/messages", response_model=list[ChatMessageRead])
async def list_conversation_messages(
    conversation_id: str,
    session: AsyncSession = Depends(get_db_session),
    current_user: ChatUser = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
) -> list[ChatMessageRead]:
    return await conversation_service.list_conversation_messages(session, current_user.id, conversation_id)


@router.put("/{conversation_id}/search-preferences", response_model=ConversationRead)
async def update_conversation_search_preferences(
    conversation_id: str,
    payload: ConversationSearchPreferencesUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user: ChatUser = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
) -> ConversationRead:
    return await conversation_service.update_conversation_search_preferences(
        session,
        current_user.id,
        conversation_id,
        payload,
    )


@router.put("/{conversation_id}/style-preferences", response_model=ConversationRead)
async def update_conversation_style_preferences(
    conversation_id: str,
    payload: ConversationStylePreferencesUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user: ChatUser = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
) -> ConversationRead:
    return await conversation_service.update_conversation_style_preferences(
        session,
        current_user.id,
        conversation_id,
        payload,
    )


@router.post("/{conversation_id}/messages", response_model=ChatTurnResponse)
async def create_message(
    conversation_id: str,
    payload: MessageCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user: ChatUser = Depends(get_current_user),
    chat_runtime: ConversationRuntimeService = Depends(get_chat_runtime),
    conversation_service: ConversationService = Depends(get_conversation_service),
) -> ChatTurnResponse:
    return await conversation_service.create_message_turn(
        session=session,
        user_id=current_user.id,
        conversation_id=conversation_id,
        content=payload.content,
        chat_runtime=chat_runtime,
    )


@router.post("/{conversation_id}/messages/with-images", response_model=ChatTurnResponse)
async def create_message_with_images(
    conversation_id: str,
    content: str = Form(default=""),
    images: list[UploadFile] | None = File(default=None),
    session: AsyncSession = Depends(get_db_session),
    current_user: ChatUser = Depends(get_current_user),
    chat_runtime: ConversationRuntimeService = Depends(get_chat_runtime),
    conversation_service: ConversationService = Depends(get_conversation_service),
) -> ChatTurnResponse:
    image_attachments = await _read_image_attachments(images or [])
    return await conversation_service.create_message_turn(
        session=session,
        user_id=current_user.id,
        conversation_id=conversation_id,
        content=content,
        chat_runtime=chat_runtime,
        image_attachments=image_attachments,
    )


@router.post("/{conversation_id}/messages/stream")
async def stream_message(
    conversation_id: str,
    payload: MessageCreate,
    request: Request,
    current_user: ChatUser = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
) -> StreamingResponse:
    chat_runtime: ConversationRuntimeService = request.app.state.chat_runtime

    async def event_stream():
        yield sse_event("status", {"stage": "accepted"})
        async with session_scope() as session:
            try:
                turn = await conversation_service.create_message_turn(
                    session=session,
                    user_id=current_user.id,
                    conversation_id=conversation_id,
                    content=payload.content,
                    chat_runtime=chat_runtime,
                )
            except Exception as exc:
                detail = getattr(exc, "detail", "The assistant could not process the message.")
                yield sse_event("error", {"detail": detail})
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

            yield sse_event("done", turn.model_dump(mode="json"))

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _read_image_attachments(images: list[UploadFile]) -> list[MessageImageAttachment]:
    if len(images) > settings.MAX_CHAT_IMAGE_ATTACHMENTS:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"You can upload up to {settings.MAX_CHAT_IMAGE_ATTACHMENTS} images per message.",
        )

    attachments: list[MessageImageAttachment] = []
    for image in images:
        content_type = (image.content_type or "").split(";", maxsplit=1)[0].lower()
        if content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Only JPEG, PNG, WEBP, or GIF images are supported.",
            )

        data = await image.read(settings.MAX_CHAT_IMAGE_UPLOAD_BYTES + 1)
        if len(data) > settings.MAX_CHAT_IMAGE_UPLOAD_BYTES:
            max_mb = settings.MAX_CHAT_IMAGE_UPLOAD_BYTES / (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Each image must be {max_mb:.0f} MB or smaller.",
            )

        encoded = base64.b64encode(data).decode("ascii")
        attachments.append(
            MessageImageAttachment(
                filename=_clean_filename(image.filename),
                content_type=content_type,
                data_url=f"data:{content_type};base64,{encoded}",
            )
        )

    return attachments


def _clean_filename(filename: str | None) -> str:
    clean_name = Path(filename or "uploaded-image").name.strip()
    return clean_name[:160] or "uploaded-image"

@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    session: AsyncSession = Depends(get_db_session),
    current_user: ChatUser = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
):
    await conversation_service.delete_conversation(session, current_user.id, conversation_id)
    return {"detail": "Conversation deleted successfully"}

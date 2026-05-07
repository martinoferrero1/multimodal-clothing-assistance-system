from __future__ import annotations

from api.route_helpers import build_message_preview
from api.schemas import ChatMessageRead, ChatTurnResponse, ConversationCreate, ConversationRead
from core.metaclasses.singleton_meta import SingletonMeta
from fastapi import HTTPException, status
from infra.db.models.chat_models import ChatMessage, Conversation, MessageRole
from services.conversation_runtime_service import ConversationRuntimeService
from sqlalchemy import case, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload


class ConversationService(metaclass=SingletonMeta):
    async def create_conversation(
        self,
        session: AsyncSession,
        user_id: str,
        payload: ConversationCreate,
    ) -> ConversationRead:
        conversation = Conversation(
            user_id=user_id,
            title=(payload.title or "New conversation").strip() or "New conversation",
        )
        session.add(conversation)
        await session.commit()
        await session.refresh(conversation)
        return ConversationRead(
            id=conversation.id,
            user_id=conversation.user_id,
            title=conversation.title,
            summary=conversation.summary,
            message_count=0,
            last_message_preview=None,
            created_at=conversation.created_at,
            updated_at=conversation.updated_at,
        )

    async def list_user_conversations(
        self,
        session: AsyncSession,
        user_id: str,
    ) -> list[ConversationRead]:
        result = await session.scalars(
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .options(selectinload(Conversation.messages))
            .order_by(Conversation.updated_at.desc(), Conversation.created_at.desc())
        )
        conversations = list(result.all())
        return [self._build_conversation_read(conversation) for conversation in conversations]

    async def get_conversation(
        self,
        session: AsyncSession,
        user_id: str,
        conversation_id: str,
    ) -> ConversationRead:
        conversation = await self._get_user_conversation(session, user_id, conversation_id, load_messages=True)
        return self._build_conversation_read(conversation)

    async def list_conversation_messages(
        self,
        session: AsyncSession,
        user_id: str,
        conversation_id: str,
    ) -> list[ChatMessageRead]:
        await self._get_user_conversation(session, user_id, conversation_id)
        result = await session.scalars(
            select(ChatMessage)
            .where(ChatMessage.conversation_id == conversation_id)
            .order_by(
                ChatMessage.created_at.asc(),
                case((ChatMessage.role == MessageRole.USER.value, 0), else_=1).asc(),
                ChatMessage.id.asc(),
            )
        )
        messages = list(result.all())
        return [ChatMessageRead.model_validate(message) for message in messages]

    async def create_message_turn(
        self,
        session: AsyncSession,
        user_id: str,
        conversation_id: str,
        content: str,
        chat_runtime: ConversationRuntimeService,
    ) -> ChatTurnResponse:
        conversation = await self._get_user_conversation(session, user_id, conversation_id)
        try:
            turn = await chat_runtime.process_user_message(session, conversation, content)
        except ValueError as exc:
            await session.rollback()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        except HTTPException:
            await session.rollback()
            raise
        except Exception as exc:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="The assistant could not process the message.",
            ) from exc

        return ChatTurnResponse(
            conversation_id=conversation_id,
            user_message=ChatMessageRead.model_validate(turn.user_message),
            assistant_message=ChatMessageRead.model_validate(turn.assistant_message),
        )

    async def _get_user_conversation(
        self,
        session: AsyncSession,
        user_id: str,
        conversation_id: str,
        load_messages: bool = False,
    ) -> Conversation:
        statement = select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id,
        )
        if load_messages:
            statement = statement.options(selectinload(Conversation.messages))

        conversation = await session.scalar(statement)
        if conversation is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
        return conversation

    def _build_conversation_read(self, conversation: Conversation) -> ConversationRead:
        messages = list(getattr(conversation, "messages", []) or [])
        last_message = messages[-1] if messages else None
        return ConversationRead(
            id=conversation.id,
            user_id=conversation.user_id,
            title=conversation.title,
            summary=conversation.summary,
            message_count=len(messages),
            last_message_preview=build_message_preview(last_message.content if last_message else None),
            created_at=conversation.created_at,
            updated_at=conversation.updated_at,
        )
    
    async def delete_conversation(
        self,
        session: AsyncSession,
        user_id: str,
        conversation_id: str,
    ) -> None:
        conversation = await self._get_user_conversation(session, user_id, conversation_id)
        await session.delete(conversation)
        await session.commit()

    async def delete_all_user_conversations(
        self,
        session: AsyncSession,
        user_id: str,
    ) -> None:
        result = await session.scalars(select(Conversation).where(Conversation.user_id == user_id))
        conversations = list(result.all())
        for conversation in conversations:
            await session.delete(conversation)
        await session.commit()

from __future__ import annotations

from datetime import datetime

from api.route_helpers import build_message_preview
from api.schemas import (
    ChatMessageRead,
    ChatTurnResponse,
    ConversationCreate,
    ConversationOrderUpdate,
    ConversationRead,
    ConversationUpdate,
    ConversationSearchPreferencesRead,
    ConversationSearchPreferencesUpdate,
    ConversationStylePreferencesUpdate,
    MessageImageAttachment,
)
from core.metaclasses.singleton_meta import SingletonMeta
from fastapi import HTTPException, status
from infra.db.models.chat_models import ChatMessage, ChatUser, Conversation, MessageRole
from schemas.outfit_maker.product_solicitation import SearchPriorityField
from services.conversation_runtime_service import ConversationRuntimeService
from services.search_preferences_service import get_search_preferences_service
from services.style_preferences_service import get_style_preferences_service
from sqlalchemy import case, inspect, select
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
        user = await self._get_user(session, user_id)
        user_priority_fields = get_search_preferences_service().user_priority_fields(user.search_preferences)
        return self._build_conversation_read(conversation, user_priority_fields, user.style_preferences)

    async def list_user_conversations(
        self,
        session: AsyncSession,
        user_id: str,
    ) -> list[ConversationRead]:
        result = await session.scalars(
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .options(selectinload(Conversation.messages))
            .order_by(
                Conversation.is_pinned.desc(),
                case((Conversation.sidebar_position.is_(None), 0), else_=1).asc(),
                case(
                    (Conversation.sidebar_position.is_(None), Conversation.updated_at),
                    else_=None,
                ).desc(),
                Conversation.sidebar_position.asc(),
                Conversation.updated_at.desc(),
                Conversation.created_at.desc(),
            )
        )
        conversations = list(result.all())
        user = await self._get_user(session, user_id)
        user_priority_fields = get_search_preferences_service().user_priority_fields(user.search_preferences)
        return [
            self._build_conversation_read(conversation, user_priority_fields, user.style_preferences)
            for conversation in conversations
        ]

    async def get_conversation(
        self,
        session: AsyncSession,
        user_id: str,
        conversation_id: str,
    ) -> ConversationRead:
        conversation = await self._get_user_conversation(session, user_id, conversation_id, load_messages=True)
        user = await self._get_user(session, user_id)
        user_priority_fields = get_search_preferences_service().user_priority_fields(user.search_preferences)
        return self._build_conversation_read(conversation, user_priority_fields, user.style_preferences)

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
        image_attachments: list[MessageImageAttachment] | None = None,
    ) -> ChatTurnResponse:
        conversation = await self._get_user_conversation(session, user_id, conversation_id)
        user = await self._get_user(session, user_id)
        search_priority_fields = get_search_preferences_service().conversation_priority_fields(
            conversation.search_preferences,
            user.search_preferences,
        )
        style_preference_context = get_style_preferences_service().effective_context(
            user.style_preferences,
            conversation.style_preferences,
        )
        try:
            turn = await chat_runtime.process_user_message(
                session,
                conversation,
                content,
                search_priority_fields=search_priority_fields,
                style_preference_context=style_preference_context.model_dump(mode="json"),
                image_attachments=image_attachments,
            )
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

    def _build_conversation_read(
        self,
        conversation: Conversation,
        user_priority_fields: list[SearchPriorityField],
        user_style_preferences: dict | None,
    ) -> ConversationRead:
        messages = self._loaded_messages(conversation)
        last_message = messages[-1] if messages else None
        search_preferences_service = get_search_preferences_service()
        override_priority_fields = search_preferences_service.conversation_override_fields(
            conversation.search_preferences
        )
        effective_priority_fields = (
            override_priority_fields
            if override_priority_fields is not None
            else user_priority_fields
        )
        return ConversationRead(
            id=conversation.id,
            user_id=conversation.user_id,
            title=conversation.title,
            is_pinned=conversation.is_pinned,
            summary=conversation.summary,
            search_preferences=ConversationSearchPreferencesRead(
                priority_fields=override_priority_fields,
                effective_priority_fields=effective_priority_fields,
            ),
            style_preferences=get_style_preferences_service().conversation_preferences(
                conversation.style_preferences,
                user_style_preferences,
            ),
            message_count=len(messages),
            last_message_preview=build_message_preview(last_message.content if last_message else None),
            created_at=conversation.created_at,
            updated_at=conversation.updated_at,
        )

    def _loaded_messages(self, conversation: Conversation) -> list[ChatMessage]:
        if "messages" in inspect(conversation).unloaded:
            return []
        return list(conversation.messages or [])

    async def _get_user(self, session: AsyncSession, user_id: str) -> ChatUser:
        user = await session.get(ChatUser, user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        return user

    async def _get_user_priority_fields(
        self,
        session: AsyncSession,
        user_id: str,
    ) -> list[SearchPriorityField]:
        user = await self._get_user(session, user_id)
        return get_search_preferences_service().user_priority_fields(user.search_preferences)

    async def update_conversation_search_preferences(
        self,
        session: AsyncSession,
        user_id: str,
        conversation_id: str,
        payload: ConversationSearchPreferencesUpdate,
    ) -> ConversationRead:
        conversation = await self._get_user_conversation(session, user_id, conversation_id)
        if payload.priority_fields is None:
            conversation.search_preferences = None
        else:
            conversation.search_preferences = get_search_preferences_service().storage_from_fields(
                payload.priority_fields
            )
        await session.commit()
        await session.refresh(conversation)
        user_priority_fields = await self._get_user_priority_fields(session, user_id)
        user = await self._get_user(session, user_id)
        return self._build_conversation_read(conversation, user_priority_fields, user.style_preferences)

    async def update_conversation_style_preferences(
        self,
        session: AsyncSession,
        user_id: str,
        conversation_id: str,
        payload: ConversationStylePreferencesUpdate,
    ) -> ConversationRead:
        conversation = await self._get_user_conversation(session, user_id, conversation_id)
        user = await self._get_user(session, user_id)
        conversation.style_preferences = get_style_preferences_service().storage_from_conversation_update(
            conversation.style_preferences,
            payload,
        )
        await session.commit()
        await session.refresh(conversation)
        user_priority_fields = get_search_preferences_service().user_priority_fields(user.search_preferences)
        return self._build_conversation_read(conversation, user_priority_fields, user.style_preferences)

    async def update_conversation(
        self,
        session: AsyncSession,
        user_id: str,
        conversation_id: str,
        payload: ConversationUpdate,
    ) -> ConversationRead:
        conversation = await self._get_user_conversation(
            session,
            user_id,
            conversation_id,
            load_messages=True,
        )
        activity_updated_at: datetime = conversation.updated_at
        if payload.title is not None:
            conversation.title = payload.title
        if payload.is_pinned is not None:
            conversation.is_pinned = payload.is_pinned
            conversation.sidebar_position = None

        conversation.updated_at = activity_updated_at

        await session.commit()
        await session.refresh(conversation)
        await session.refresh(conversation, attribute_names=["messages"])
        user = await self._get_user(session, user_id)
        user_priority_fields = get_search_preferences_service().user_priority_fields(
            user.search_preferences
        )
        return self._build_conversation_read(
            conversation,
            user_priority_fields,
            user.style_preferences,
        )

    async def reorder_conversations(
        self,
        session: AsyncSession,
        user_id: str,
        payload: ConversationOrderUpdate,
    ) -> list[ConversationRead]:
        result = await session.scalars(
            select(Conversation).where(
                Conversation.user_id == user_id,
                Conversation.id.in_(payload.conversation_ids),
            )
        )
        conversations = list(result.all())
        if len(conversations) != len(payload.conversation_ids):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="One or more conversations were not found.",
            )
        if len({conversation.is_pinned for conversation in conversations}) != 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Pinned and unpinned conversations must be reordered separately.",
            )

        conversations_by_id = {
            conversation.id: conversation
            for conversation in conversations
        }
        for position, conversation_id in enumerate(payload.conversation_ids):
            conversations_by_id[conversation_id].sidebar_position = position

        await session.commit()
        return await self.list_user_conversations(session, user_id)
    
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

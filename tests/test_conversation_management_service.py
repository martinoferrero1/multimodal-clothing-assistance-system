from __future__ import annotations

import unittest
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from api.schemas import ConversationOrderUpdate, ConversationUpdate
from infra.db.models.base import Base
from infra.db.models.chat_models import ChatMessage, ChatUser, Conversation, MessageRole
from services.conversation_service import ConversationService


class ConversationManagementServiceTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with self.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        self.session_factory = async_sessionmaker(
            self.engine,
            expire_on_commit=False,
            autoflush=False,
        )

    async def asyncTearDown(self) -> None:
        await self.engine.dispose()

    async def test_conversation_can_be_renamed_and_pinned(self) -> None:
        service = ConversationService()

        async with self.session_factory() as session:
            user = ChatUser(display_name="Test", email="manage@example.com")
            session.add(user)
            await session.flush()
            conversation = Conversation(user_id=user.id, title="Original")
            session.add(conversation)
            await session.flush()
            session.add_all(
                [
                    ChatMessage(
                        conversation_id=conversation.id,
                        role=MessageRole.USER.value,
                        content="Quiero un outfit casual.",
                    ),
                    ChatMessage(
                        conversation_id=conversation.id,
                        role=MessageRole.ASSISTANT.value,
                        content="Te preparé una propuesta casual.",
                    ),
                ]
            )
            await session.commit()
            await session.refresh(conversation)
            activity_updated_at = conversation.updated_at

            updated = await service.update_conversation(
                session,
                user.id,
                conversation.id,
                ConversationUpdate(title="  Capsule wardrobe  ", is_pinned=True),
            )

        self.assertEqual(updated.title, "Capsule wardrobe")
        self.assertTrue(updated.is_pinned)
        self.assertEqual(updated.updated_at, activity_updated_at)
        self.assertEqual(updated.message_count, 2)
        self.assertEqual(
            updated.last_message_preview,
            "Te preparé una propuesta casual.",
        )

    async def test_pinned_conversations_are_listed_first(self) -> None:
        service = ConversationService()
        now = datetime.now(UTC)

        async with self.session_factory() as session:
            user = ChatUser(display_name="Test", email="order@example.com")
            session.add(user)
            await session.flush()
            session.add_all(
                [
                    Conversation(
                        user_id=user.id,
                        title="Recent",
                        is_pinned=False,
                        created_at=now,
                        updated_at=now,
                    ),
                    Conversation(
                        user_id=user.id,
                        title="Pinned",
                        is_pinned=True,
                        created_at=now - timedelta(days=2),
                        updated_at=now - timedelta(days=2),
                    ),
                ]
            )
            await session.commit()

            conversations = await service.list_user_conversations(session, user.id)

        self.assertEqual([conversation.title for conversation in conversations], ["Pinned", "Recent"])

    async def test_manual_conversation_order_is_persisted(self) -> None:
        service = ConversationService()

        async with self.session_factory() as session:
            user = ChatUser(display_name="Test", email="reorder@example.com")
            session.add(user)
            await session.flush()
            conversations = [
                Conversation(user_id=user.id, title=title)
                for title in ("First", "Second", "Third")
            ]
            session.add_all(conversations)
            await session.commit()

            ordered = await service.reorder_conversations(
                session,
                user.id,
                ConversationOrderUpdate(
                    conversation_ids=[
                        conversations[2].id,
                        conversations[0].id,
                        conversations[1].id,
                    ]
                ),
            )

        self.assertEqual(
            [conversation.title for conversation in ordered],
            ["Third", "First", "Second"],
        )

    def test_conversation_update_rejects_empty_payload(self) -> None:
        with self.assertRaises(ValueError):
            ConversationUpdate()


if __name__ == "__main__":
    unittest.main()

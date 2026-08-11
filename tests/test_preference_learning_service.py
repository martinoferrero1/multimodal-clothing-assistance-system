from __future__ import annotations

import unittest
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from infra.db.models.base import Base
from infra.db.models.chat_models import ChatUser, UserPreferenceAggregate, UserPreferenceSignal
from schemas.outfit_maker.product_solicitation import GarmentSpec, ItemSpecList
from services.preference_learning_service import PreferenceLearningService
from services.style_preferences_service import StylePreferencesService


class PreferenceLearningServiceTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with self.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        self.session_factory = async_sessionmaker(self.engine, expire_on_commit=False, autoflush=False)

    async def asyncTearDown(self) -> None:
        await self.engine.dispose()

    async def test_request_field_signal_is_recorded_but_not_promoted_after_one_observation(self) -> None:
        service = PreferenceLearningService()
        request = ItemSpecList(items=[GarmentSpec(base_colors=["negro"], brands=["Nike"])])

        async with self.session_factory() as session:
            user = ChatUser(display_name="Test", email="test@example.com")
            session.add(user)
            await session.flush()

            await service.record_turn(
                session,
                user_id=user.id,
                conversation_id="conversation-id",
                message_id="message-id",
                message_content="Busco zapatillas negras Nike.",
                request=request,
                learning_enabled=True,
            )
            await session.flush()

            signals = list((await session.scalars(select(UserPreferenceSignal))).all())
            aggregates = list((await session.scalars(select(UserPreferenceAggregate))).all())
            await session.refresh(user)

        self.assertTrue(any(signal.field == "base_colors" and signal.value == "Black" for signal in signals))
        self.assertTrue(any(aggregate.field == "brands" and aggregate.value == "Nike" for aggregate in aggregates))
        self.assertEqual(StylePreferencesService().user_preferences(user.style_preferences).inferred, [])

    async def test_repeated_recent_requests_promote_learned_preference(self) -> None:
        service = PreferenceLearningService()
        request = ItemSpecList(items=[GarmentSpec(base_colors=["black"])])

        async with self.session_factory() as session:
            user = ChatUser(display_name="Test", email="repeat@example.com")
            session.add(user)
            await session.flush()

            for index in range(3):
                await service.record_turn(
                    session,
                    user_id=user.id,
                    conversation_id="conversation-id",
                    message_id=f"message-{index}",
                    message_content="Show me black sneakers.",
                    request=request,
                    learning_enabled=True,
                )
            await session.flush()
            await session.refresh(user)

        inferred = StylePreferencesService().user_preferences(user.style_preferences).inferred
        black = next(entry for entry in inferred if entry.value == "Black")
        self.assertEqual(black.occurrence_count, 3)
        self.assertGreaterEqual(black.confidence, 0.58)
        self.assertEqual(black.source, "learned")

    def test_recent_score_decays_for_stale_observations(self) -> None:
        service = PreferenceLearningService()
        now = datetime.now(UTC)

        recent = service._recent_score(3.0, now - timedelta(days=1), now)
        stale = service._recent_score(3.0, now - timedelta(days=180), now)

        self.assertGreater(recent, stale)

    def test_explicit_positive_and_negative_language_is_detected(self) -> None:
        service = PreferenceLearningService()

        signals = service.detect_signals("Prefiero Nike. No me gusta Adidas. Me gusta lo minimalista.", None)

        self.assertTrue(any(signal.field == "brands" and signal.value == "Nike" and signal.polarity == "positive" for signal in signals))
        self.assertTrue(any(signal.field == "brands" and signal.value == "Adidas" and signal.polarity == "negative" for signal in signals))
        self.assertTrue(any(signal.field == "liked_styles" and signal.value == "Minimalist" for signal in signals))

    async def test_contradiction_lowers_existing_preference_confidence(self) -> None:
        service = PreferenceLearningService()

        async with self.session_factory() as session:
            user = ChatUser(display_name="Test", email="conflict@example.com")
            session.add(user)
            await session.flush()

            await service.record_turn(
                session,
                user_id=user.id,
                conversation_id="conversation-id",
                message_id="positive",
                message_content="Prefiero Nike.",
                request=None,
                learning_enabled=True,
            )
            positive_before = await session.scalar(
                select(UserPreferenceAggregate).where(UserPreferenceAggregate.value == "Nike")
            )
            self.assertIsNotNone(positive_before)
            confidence_before = positive_before.confidence

            await service.record_turn(
                session,
                user_id=user.id,
                conversation_id="conversation-id",
                message_id="negative",
                message_content="No me gusta Nike.",
                request=None,
                learning_enabled=True,
            )
            positive_after = await session.scalar(
                select(UserPreferenceAggregate).where(
                    UserPreferenceAggregate.value == "Nike",
                    UserPreferenceAggregate.polarity == "positive",
                )
            )

        self.assertLess(positive_after.confidence, confidence_before)

    async def test_suppressed_learned_preference_is_not_republished_from_old_evidence(self) -> None:
        service = PreferenceLearningService()

        async with self.session_factory() as session:
            user = ChatUser(display_name="Test", email="suppress@example.com")
            session.add(user)
            await session.flush()

            await service.record_turn(
                session,
                user_id=user.id,
                conversation_id="conversation-id",
                message_id="message-id",
                message_content="Prefiero Nike.",
                request=None,
                learning_enabled=True,
            )
            await session.flush()
            await session.refresh(user)
            inferred = StylePreferencesService().user_preferences(user.style_preferences).inferred
            learned_id = inferred[0].id

            await service.suppress_inferred_preference(
                session,
                user_id=user.id,
                raw_preferences=user.style_preferences,
                inferred_id=learned_id,
            )
            user.style_preferences = StylePreferencesService().storage_without_inferred(user.style_preferences, learned_id)[0]
            await service.record_turn(
                session,
                user_id=user.id,
                conversation_id="conversation-id",
                message_id="message-id-2",
                message_content="Prefiero Nike.",
                request=None,
                learning_enabled=True,
            )
            await session.flush()
            await session.refresh(user)

        self.assertEqual(StylePreferencesService().user_preferences(user.style_preferences).inferred, [])


if __name__ == "__main__":
    unittest.main()

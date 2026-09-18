from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from types import SimpleNamespace

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from api.schemas import StoreCommunityListingWrite
from infra.db.models.base import Base
from infra.db.models.chat_models import ChatUser, Store
import infra.db.models.store_community_models  # noqa: F401
from services.store_community_service import StoreCommunityService


def _store(identifier: str, handle: str) -> Store:
    return Store(
        id=identifier,
        legal_name=f"{handle} LLC",
        display_name=f"{handle} Store",
        public_handle=handle,
        jurisdiction="AR",
        business_identifier=f"AR-{identifier}",
        address="Address 1",
        contact_email=f"{handle}@example.com",
        contact_phone="+541100000000",
        status="active",
    )


def _context(store: Store):
    return SimpleNamespace(store=store)


def test_store_community_listings_are_public_only_for_active_stores_and_scoped_to_the_owner() -> None:
    async def exercise() -> None:
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        service = StoreCommunityService()

        async with session_factory() as session:
            first_store = _store("store-one", "one")
            second_store = _store("store-two", "two")
            user = ChatUser(id="consumer-one", display_name="Consumer")
            code_user = ChatUser(id="consumer-two", display_name="Code consumer")
            user_id = user.id
            session.add_all([first_store, second_store, user, code_user])
            await session.commit()
            first_context = _context(SimpleNamespace(
                id=first_store.id,
                display_name=first_store.display_name,
                public_handle=first_store.public_handle,
            ))
            second_context = _context(SimpleNamespace(
                id=second_store.id,
                display_name=second_store.display_name,
                public_handle=second_store.public_handle,
            ))

            created = await service.create_listing(
                session,
                first_context,
                StoreCommunityListingWrite(
                    kind="event",
                    title="Desfile de primavera",
                    description="Una noche para descubrir nuevas colecciones.",
                    location="Palermo",
                    starts_at=datetime(2026, 10, 1, 20, 0, tzinfo=UTC),
                    join_code="Primavera-26",
                ),
            )
            public = await service.list_public_listings(session, user_id)
            assert [(item.id, item.store_display_name, item.is_subscribed) for item in public] == [
                (created.id, "one Store", False)
            ]
            assert "join_code" not in public[0].model_dump()
            assert created.join_code == "primavera-26"

            assert await service.subscribe_by_code(session, code_user, "primavera-26") == created.id
            assert (await service.list_public_listings(session, code_user.id))[0].is_subscribed

            assert await service.subscribe(session, user, created.id)
            assert (await service.list_public_listings(session, user_id))[0].is_subscribed

            assert await service.update_listing(
                session,
                second_context,
                created.id,
                StoreCommunityListingWrite(kind="blog", title="No permitido"),
            ) is None
            assert not await service.delete_listing(session, second_context, created.id)

            updated = await service.update_listing(
                session,
                first_context,
                created.id,
                StoreCommunityListingWrite(kind="blog", title="Diario de moda"),
            )
            assert updated is not None
            assert updated.title == "Diario de moda"

            active_first_store = await session.get(Store, first_context.store.id)
            assert active_first_store is not None
            active_first_store.status = "suspended"
            await session.commit()
            assert await service.list_public_listings(session, user_id) == []

        await engine.dispose()

    asyncio.run(exercise())

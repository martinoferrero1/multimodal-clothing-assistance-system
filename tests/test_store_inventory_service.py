from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from api.schemas import StoreInventoryImport, StoreInventoryItemWrite
from infra.db.models.base import Base
from infra.db.models.chat_models import Store
from infra.db.models.store_inventory_models import StoreInventoryItem
from services.store_inventory_service import StoreInventoryService


def _store(identifier: str, handle: str) -> Store:
    return Store(
        id=identifier,
        legal_name=f"{handle} LLC",
        display_name=handle,
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


def test_store_inventory_is_scoped_to_the_active_store_and_bulk_import_upserts() -> None:
    async def exercise() -> None:
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        service = StoreInventoryService()

        async with session_factory() as session:
            first_store = _store("store-one", "one")
            second_store = _store("store-two", "two")
            session.add_all([first_store, second_store])
            await session.commit()
            first_context = _context(SimpleNamespace(id=first_store.id))
            second_context = _context(SimpleNamespace(id=second_store.id))

            created = await service.create_item(
                session,
                first_context,
                StoreInventoryItemWrite(
                    external_id="SKU-001",
                    product_display_name="Campera urbana",
                    masterCategory="Apparel",
                    image_front="https://cdn.example.com/sku-001-front.jpg",
                    image_back="https://cdn.example.com/sku-001-back.jpg",
                ),
            )
            assert created.external_id == "sku-001"
            assert created.image_back.endswith("back.jpg")
            assert await service.list_items(session, second_context) == []

            summary = await service.import_items(
                session,
                first_context,
                StoreInventoryImport(
                    items=[
                        StoreInventoryItemWrite(
                            external_id="SKU-001",
                            product_display_name="Campera urbana actualizada",
                            price=49999,
                            image_default="https://cdn.example.com/sku-001-default.jpg",
                        ),
                        StoreInventoryItemWrite(
                            external_id="SKU-002",
                            product_display_name="Remera esencial",
                            colour1="Negro",
                        ),
                    ]
                ),
            )
            assert (summary.created_count, summary.updated_count, summary.total_count) == (1, 1, 2)
            items = await service.list_items(session, first_context)
            assert {item.external_id for item in items} == {"sku-001", "sku-002"}
            updated = next(item for item in items if item.external_id == "sku-001")
            assert updated.product_display_name == "Campera urbana actualizada"
            assert updated.price == 49999

            duplicate = StoreInventoryItem(
                store_id=second_store.id,
                external_id="sku-001",
                product_display_name="Item aislado",
            )
            session.add(duplicate)
            await session.commit()
            assert len(await service.list_items(session, second_context)) == 1

            session.add(StoreInventoryItem(
                store_id=first_store.id,
                external_id="sku-001",
                product_display_name="Duplicado",
            ))
            with pytest.raises(IntegrityError):
                await session.commit()
            await session.rollback()
            assert len(await service.list_items(session, first_context)) == 2

        await engine.dispose()

    asyncio.run(exercise())


def test_inventory_import_rejects_duplicate_external_ids_case_insensitively() -> None:
    with pytest.raises(ValueError, match="distinct external IDs"):
        StoreInventoryImport.model_validate({
            "items": [
                {"id": "SKU-1", "productDisplayName": "One"},
                {"id": "sku-1", "productDisplayName": "Two"},
            ]
        })

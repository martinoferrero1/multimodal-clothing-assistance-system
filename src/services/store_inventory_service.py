from __future__ import annotations

from decimal import Decimal

from api.schemas import StoreInventoryImport, StoreInventoryImportRead, StoreInventoryItemRead, StoreInventoryItemWrite
from infra.db.models.store_inventory_models import StoreInventoryItem
from services.store_service import CommercialContext
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


class StoreInventoryService:
    """Private inventory. Items intentionally remain outside the public catalog."""

    async def list_items(self, session: AsyncSession, context: CommercialContext) -> list[StoreInventoryItemRead]:
        result = await session.scalars(
            select(StoreInventoryItem)
            .where(StoreInventoryItem.store_id == context.store.id)
            .order_by(StoreInventoryItem.updated_at.desc(), StoreInventoryItem.id.desc())
        )
        return [self._read(item) for item in result]

    async def create_item(
        self, session: AsyncSession, context: CommercialContext, payload: StoreInventoryItemWrite
    ) -> StoreInventoryItemRead:
        item = StoreInventoryItem(store_id=context.store.id)
        self._apply(item, payload)
        session.add(item)
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
            raise
        await session.refresh(item)
        return self._read(item)

    async def import_items(
        self, session: AsyncSession, context: CommercialContext, payload: StoreInventoryImport
    ) -> StoreInventoryImportRead:
        ids = [self._external_id(item.external_id) for item in payload.items]
        existing = await session.scalars(
            select(StoreInventoryItem).where(
                StoreInventoryItem.store_id == context.store.id,
                StoreInventoryItem.external_id.in_(ids),
            )
        )
        by_external_id = {item.external_id: item for item in existing}
        created_count = 0
        updated_count = 0
        for payload_item in payload.items:
            external_id = self._external_id(payload_item.external_id)
            item = by_external_id.get(external_id)
            if item is None:
                item = StoreInventoryItem(store_id=context.store.id)
                session.add(item)
                created_count += 1
            else:
                updated_count += 1
            self._apply(item, payload_item)
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
            raise
        return StoreInventoryImportRead(
            created_count=created_count,
            updated_count=updated_count,
            total_count=len(payload.items),
        )

    @classmethod
    def _apply(cls, item: StoreInventoryItem, payload: StoreInventoryItemWrite) -> None:
        values = payload.model_dump()
        values["external_id"] = cls._external_id(values["external_id"])
        values["price"] = None if values["price"] is None else Decimal(str(values["price"]))
        for field, value in values.items():
            setattr(item, field, value)

    @staticmethod
    def _external_id(value: str) -> str:
        return value.casefold()

    @staticmethod
    def _read(item: StoreInventoryItem) -> StoreInventoryItemRead:
        return StoreInventoryItemRead.model_validate(item)

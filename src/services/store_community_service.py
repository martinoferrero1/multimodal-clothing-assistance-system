from __future__ import annotations

from api.schemas import StoreCommunityListingManagementRead, StoreCommunityListingRead, StoreCommunityListingWrite
from infra.db.models.chat_models import ChatUser, Store, StoreStatus
from infra.db.models.store_community_models import StoreCommunityListing, StoreCommunitySubscription
from services.store_service import CommercialContext
from sqlalchemy import and_, delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


class StoreCommunityService:
    async def list_public_listings(
        self, session: AsyncSession, user_id: str
    ) -> list[StoreCommunityListingRead]:
        rows = await session.execute(
            select(
                StoreCommunityListing,
                Store.display_name,
                Store.public_handle,
                StoreCommunitySubscription.id,
            )
            .join(Store, Store.id == StoreCommunityListing.store_id)
            .outerjoin(
                StoreCommunitySubscription,
                and_(
                    StoreCommunitySubscription.listing_id == StoreCommunityListing.id,
                    StoreCommunitySubscription.user_id == user_id,
                ),
            )
            .where(Store.status == StoreStatus.ACTIVE.value)
            .order_by(StoreCommunityListing.starts_at.asc().nulls_last(), StoreCommunityListing.updated_at.desc())
        )
        return [
            self._read(listing, store_name, store_handle, is_subscribed=subscription_id is not None)
            for listing, store_name, store_handle, subscription_id in rows
        ]

    async def list_store_listings(
        self, session: AsyncSession, context: CommercialContext
    ) -> list[StoreCommunityListingManagementRead]:
        listings = await session.scalars(
            select(StoreCommunityListing)
            .where(StoreCommunityListing.store_id == context.store.id)
            .order_by(StoreCommunityListing.updated_at.desc())
        )
        return [self._management_read(listing, context.store.display_name, context.store.public_handle) for listing in listings]

    async def create_listing(
        self, session: AsyncSession, context: CommercialContext, payload: StoreCommunityListingWrite
    ) -> StoreCommunityListingManagementRead:
        listing = StoreCommunityListing(store_id=context.store.id)
        self._apply(listing, payload)
        session.add(listing)
        await session.commit()
        await session.refresh(listing)
        return self._management_read(listing, context.store.display_name, context.store.public_handle)

    async def update_listing(
        self,
        session: AsyncSession,
        context: CommercialContext,
        listing_id: str,
        payload: StoreCommunityListingWrite,
    ) -> StoreCommunityListingManagementRead | None:
        listing = await session.scalar(
            select(StoreCommunityListing).where(
                StoreCommunityListing.id == listing_id,
                StoreCommunityListing.store_id == context.store.id,
            )
        )
        if listing is None:
            return None
        self._apply(listing, payload)
        await session.commit()
        await session.refresh(listing)
        return self._management_read(listing, context.store.display_name, context.store.public_handle)

    async def delete_listing(self, session: AsyncSession, context: CommercialContext, listing_id: str) -> bool:
        result = await session.execute(
            delete(StoreCommunityListing).where(
                StoreCommunityListing.id == listing_id,
                StoreCommunityListing.store_id == context.store.id,
            )
        )
        if not result.rowcount:
            await session.rollback()
            return False
        await session.commit()
        return True

    async def subscribe(self, session: AsyncSession, user: ChatUser, listing_id: str) -> bool:
        listing = await self._public_listing(session, listing_id)
        if listing is None:
            return False
        existing = await session.scalar(
            select(StoreCommunitySubscription).where(
                StoreCommunitySubscription.listing_id == listing.id,
                StoreCommunitySubscription.user_id == user.id,
            )
        )
        if existing is None:
            session.add(StoreCommunitySubscription(listing_id=listing.id, user_id=user.id))
            try:
                await session.commit()
            except IntegrityError:
                await session.rollback()
        return True

    async def unsubscribe(self, session: AsyncSession, user: ChatUser, listing_id: str) -> bool:
        result = await session.execute(
            delete(StoreCommunitySubscription).where(
                StoreCommunitySubscription.listing_id == listing_id,
                StoreCommunitySubscription.user_id == user.id,
            )
        )
        if result.rowcount:
            await session.commit()
        else:
            await session.rollback()
        return True

    async def subscribe_by_code(self, session: AsyncSession, user: ChatUser, code: str) -> str | None:
        listing = await session.scalar(
            select(StoreCommunityListing)
            .join(Store, Store.id == StoreCommunityListing.store_id)
            .where(StoreCommunityListing.join_code == code, Store.status == StoreStatus.ACTIVE.value)
        )
        if listing is None or not await self.subscribe(session, user, listing.id):
            return None
        return listing.id

    async def _public_listing(self, session: AsyncSession, listing_id: str) -> StoreCommunityListing | None:
        return await session.scalar(
            select(StoreCommunityListing)
            .join(Store, Store.id == StoreCommunityListing.store_id)
            .where(StoreCommunityListing.id == listing_id, Store.status == StoreStatus.ACTIVE.value)
        )

    @staticmethod
    def _apply(listing: StoreCommunityListing, payload: StoreCommunityListingWrite) -> None:
        for field, value in payload.model_dump().items():
            setattr(listing, field, value)

    @staticmethod
    def _read(
        listing: StoreCommunityListing,
        store_name: str,
        store_handle: str,
        *,
        is_subscribed: bool = False,
    ) -> StoreCommunityListingRead:
        return StoreCommunityListingRead.model_validate(listing).model_copy(
            update={
                "store_display_name": store_name,
                "store_handle": store_handle,
                "is_subscribed": is_subscribed,
            }
        )

    @classmethod
    def _management_read(
        cls,
        listing: StoreCommunityListing,
        store_name: str,
        store_handle: str,
    ) -> StoreCommunityListingManagementRead:
        public_read = cls._read(listing, store_name, store_handle)
        return StoreCommunityListingManagementRead.model_validate(public_read).model_copy(
            update={"join_code": listing.join_code}
        )

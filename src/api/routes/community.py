from __future__ import annotations

from api.dependencies import enforce_rate_limit, get_commercial_context, get_current_session, get_db_session
from api.schemas import (
    StoreCommunityJoinCode,
    StoreCommunityJoinStateRead,
    StoreCommunityListingManagementRead,
    StoreCommunityListingRead,
    StoreCommunityListingWrite,
    StoreCommunitySubscriptionStateRead,
)
from fastapi import APIRouter, Depends, HTTPException, Request, status
from infra.db.models.chat_models import ChatUser
from services.store_community_service import StoreCommunityService
from services.store_service import CommercialContext
from services.auth_service import CurrentSession
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError


public_router = APIRouter(prefix="/api/community", tags=["community"])
store_router = APIRouter(prefix="/api/store/community", tags=["store-community"])


def get_store_community_service() -> StoreCommunityService:
    return StoreCommunityService()


async def get_consumer_user(current: CurrentSession = Depends(get_current_session)) -> ChatUser:
    if current.user.account_kind != "consumer" or current.session.active_store_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Community subscriptions are for consumer accounts.")
    return current.user


async def _enforce_store_limit(request: Request, context: CommercialContext) -> None:
    await enforce_rate_limit(
        request,
        "store_inventory",
        user_id=context.current.user.id,
        store=context.store.id,
    )


@public_router.get("/listings", response_model=list[StoreCommunityListingRead])
async def list_community_listings(
    current_user: ChatUser = Depends(get_consumer_user),
    session: AsyncSession = Depends(get_db_session),
    service: StoreCommunityService = Depends(get_store_community_service),
) -> list[StoreCommunityListingRead]:
    return await service.list_public_listings(session, current_user.id)


@public_router.post("/listings/{listing_id}/subscribe", response_model=StoreCommunitySubscriptionStateRead)
async def subscribe_to_listing(
    listing_id: str,
    request: Request,
    current_user: ChatUser = Depends(get_consumer_user),
    session: AsyncSession = Depends(get_db_session),
    service: StoreCommunityService = Depends(get_store_community_service),
) -> StoreCommunitySubscriptionStateRead:
    await enforce_rate_limit(request, "message", user_id=current_user.id)
    if not await service.subscribe(session, current_user, listing_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community listing not found.")
    return StoreCommunitySubscriptionStateRead(is_subscribed=True)


@public_router.delete("/listings/{listing_id}/subscribe", response_model=StoreCommunitySubscriptionStateRead)
async def unsubscribe_from_listing(
    listing_id: str,
    request: Request,
    current_user: ChatUser = Depends(get_consumer_user),
    session: AsyncSession = Depends(get_db_session),
    service: StoreCommunityService = Depends(get_store_community_service),
) -> StoreCommunitySubscriptionStateRead:
    await enforce_rate_limit(request, "message", user_id=current_user.id)
    await service.unsubscribe(session, current_user, listing_id)
    return StoreCommunitySubscriptionStateRead(is_subscribed=False)


@public_router.post("/join", response_model=StoreCommunityJoinStateRead)
async def join_listing_by_code(
    payload: StoreCommunityJoinCode,
    request: Request,
    current_user: ChatUser = Depends(get_consumer_user),
    session: AsyncSession = Depends(get_db_session),
    service: StoreCommunityService = Depends(get_store_community_service),
) -> StoreCommunityJoinStateRead:
    await enforce_rate_limit(request, "message", user_id=current_user.id)
    listing_id = await service.subscribe_by_code(session, current_user, payload.code)
    if listing_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community listing not found.")
    return StoreCommunityJoinStateRead(is_subscribed=True, listing_id=listing_id)


@store_router.get("/listings", response_model=list[StoreCommunityListingManagementRead])
async def list_store_community_listings(
    context: CommercialContext = Depends(get_commercial_context),
    session: AsyncSession = Depends(get_db_session),
    service: StoreCommunityService = Depends(get_store_community_service),
) -> list[StoreCommunityListingManagementRead]:
    return await service.list_store_listings(session, context)


@store_router.post("/listings", response_model=StoreCommunityListingManagementRead, status_code=status.HTTP_201_CREATED)
async def create_store_community_listing(
    payload: StoreCommunityListingWrite,
    request: Request,
    context: CommercialContext = Depends(get_commercial_context),
    session: AsyncSession = Depends(get_db_session),
    service: StoreCommunityService = Depends(get_store_community_service),
) -> StoreCommunityListingManagementRead:
    await _enforce_store_limit(request, context)
    try:
        return await service.create_listing(session, context, payload)
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This join code is already in use.") from None


@store_router.put("/listings/{listing_id}", response_model=StoreCommunityListingManagementRead)
async def update_store_community_listing(
    listing_id: str,
    payload: StoreCommunityListingWrite,
    request: Request,
    context: CommercialContext = Depends(get_commercial_context),
    session: AsyncSession = Depends(get_db_session),
    service: StoreCommunityService = Depends(get_store_community_service),
) -> StoreCommunityListingManagementRead:
    await _enforce_store_limit(request, context)
    try:
        listing = await service.update_listing(session, context, listing_id, payload)
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This join code is already in use.") from None
    if listing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community listing not found.")
    return listing


@store_router.delete("/listings/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_store_community_listing(
    listing_id: str,
    request: Request,
    context: CommercialContext = Depends(get_commercial_context),
    session: AsyncSession = Depends(get_db_session),
    service: StoreCommunityService = Depends(get_store_community_service),
) -> None:
    await _enforce_store_limit(request, context)
    if not await service.delete_listing(session, context, listing_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community listing not found.")

from __future__ import annotations

from api.dependencies import enforce_rate_limit, get_commercial_context, get_db_session
from api.schemas import StoreInventoryImport, StoreInventoryImportRead, StoreInventoryItemRead, StoreInventoryItemWrite
from fastapi import APIRouter, Depends, HTTPException, Request, status
from services.store_inventory_service import StoreInventoryService
from services.store_service import CommercialContext
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/store/inventory", tags=["store-inventory"])


def get_store_inventory_service() -> StoreInventoryService:
    return StoreInventoryService()


async def _enforce_inventory_limit(request: Request, context: CommercialContext) -> None:
    await enforce_rate_limit(
        request,
        "store_inventory",
        user_id=context.current.user.id,
        store=context.store.id,
    )


@router.get("/items", response_model=list[StoreInventoryItemRead])
async def list_inventory_items(
    context: CommercialContext = Depends(get_commercial_context),
    session: AsyncSession = Depends(get_db_session),
    service: StoreInventoryService = Depends(get_store_inventory_service),
) -> list[StoreInventoryItemRead]:
    return await service.list_items(session, context)


@router.post("/items", response_model=StoreInventoryItemRead, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    payload: StoreInventoryItemWrite,
    request: Request,
    context: CommercialContext = Depends(get_commercial_context),
    session: AsyncSession = Depends(get_db_session),
    service: StoreInventoryService = Depends(get_store_inventory_service),
) -> StoreInventoryItemRead:
    await _enforce_inventory_limit(request, context)
    try:
        return await service.create_item(session, context, payload)
    except IntegrityError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This external ID already exists in the store inventory.") from exc


@router.post("/import", response_model=StoreInventoryImportRead)
async def import_inventory_items(
    payload: StoreInventoryImport,
    request: Request,
    context: CommercialContext = Depends(get_commercial_context),
    session: AsyncSession = Depends(get_db_session),
    service: StoreInventoryService = Depends(get_store_inventory_service),
) -> StoreInventoryImportRead:
    await _enforce_inventory_limit(request, context)
    try:
        return await service.import_items(session, context, payload)
    except IntegrityError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The inventory import could not be completed.") from exc

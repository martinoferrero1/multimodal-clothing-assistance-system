from __future__ import annotations

from typing import Literal

from api.dependencies import enforce_rate_limit, get_current_user, get_db_session
from api.schemas import CatalogMetaRead, CatalogPageRead
from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, status
from infra.db.models.chat_models import ChatUser
from services.chat_image_upload_service import read_image_attachments
from services.catalog_service import CatalogService
from services.image_similarity_service import ImageSimilarityService
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/catalog", tags=["catalog"])


def get_catalog_service() -> CatalogService:
    return CatalogService()


@router.get("/meta", response_model=CatalogMetaRead)
async def get_catalog_meta(
    _current_user: ChatUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    service: CatalogService = Depends(get_catalog_service),
) -> CatalogMetaRead:
    return await service.get_meta(session)


@router.get("/products", response_model=CatalogPageRead)
async def list_catalog_products(
    query: str | None = Query(default=None, max_length=160),
    master_category: str | None = Query(default=None, max_length=120),
    sub_category: str | None = Query(default=None, max_length=120),
    article_type: str | None = Query(default=None, max_length=120),
    brand: str | None = Query(default=None, max_length=120),
    try_on_only: bool = False,
    sort: Literal["relevance", "newest", "priceAsc", "priceDesc"] = "relevance",
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=12, ge=1, le=48),
    _current_user: ChatUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    service: CatalogService = Depends(get_catalog_service),
) -> CatalogPageRead:
    return await service.list_products(
        session,
        query=query.strip() if query else None,
        master_category=master_category,
        sub_category=sub_category,
        article_type=article_type,
        brand=brand,
        try_on_only=try_on_only,
        sort=sort,
        offset=offset,
        limit=limit,
    )


@router.post("/visual-search", response_model=CatalogPageRead)
async def search_catalog_by_image(
    request: Request,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=12, ge=1, le=48),
    _current_user: ChatUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    service: CatalogService = Depends(get_catalog_service),
) -> CatalogPageRead:
    await enforce_rate_limit(request, "image", user_id=_current_user.id)
    form = await request.form()
    images = [item for item in form.getlist("images") if isinstance(item, UploadFile)]
    if not images:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one image is required for visual search.",
        )
    attachments = await read_image_attachments(images)
    features = ImageSimilarityService().extract_attachment_features(
        [attachment.model_dump(mode="json") for attachment in attachments],
        force_visual_search=True,
    )
    if not features:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The image could not be analyzed for visual search.",
        )
    return await service.list_visual_products(
        session,
        image_search_features=features,
        offset=offset,
        limit=limit,
    )

from __future__ import annotations

from typing import Any, Literal

from api.schemas import (
    CatalogMetaRead,
    CatalogPageRead,
    CatalogProductImagesRead,
    CatalogProductRead,
    CatalogSubcategoryRead,
    CatalogTaxonomyRead,
)
from infra.db.models.catalog_models import (
    ArticleType,
    Brand,
    Gender,
    MasterCategory,
    Product,
    Season,
    SubCategory,
)
from services.image_similarity_service import score_products_by_image_similarity
from sqlalchemy import Select, and_, case, func, or_, select
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.ext.asyncio import AsyncSession


CatalogSort = Literal["relevance", "newest", "priceAsc", "priceDesc"]


def _valid_image(column):
    return and_(
        column.is_not(None),
        func.lower(func.trim(column)).not_in(("", "na", "nan", "none", "null")),
    )


def _clean_optional(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    if not cleaned or cleaned.casefold() in {"na", "nan", "none", "null"}:
        return None
    return cleaned


class CatalogService:
    async def get_meta(self, session: AsyncSession) -> CatalogMetaRead:
        taxonomy_rows = (
            await session.execute(
                select(MasterCategory.name, SubCategory.name, ArticleType.name)
                .join(SubCategory, SubCategory.master_category_id == MasterCategory.id)
                .join(ArticleType, ArticleType.sub_category_id == SubCategory.id)
                .order_by(MasterCategory.name, SubCategory.name, ArticleType.name)
            )
        ).all()

        tree: dict[str, dict[str, list[str]]] = {}
        for master_name, subcategory_name, article_name in taxonomy_rows:
            articles = tree.setdefault(master_name, {}).setdefault(subcategory_name, [])
            if article_name not in articles:
                articles.append(article_name)

        taxonomy = [
            CatalogTaxonomyRead(
                name=master_name,
                subcategories=[
                    CatalogSubcategoryRead(name=subcategory_name, article_types=article_types)
                    for subcategory_name, article_types in subcategories.items()
                ],
            )
            for master_name, subcategories in tree.items()
        ]

        brands = list(
            (
                await session.scalars(
                    select(Brand.name)
                    .where(func.lower(func.trim(Brand.name)).not_in(("", "na", "nan", "none", "null")))
                    .order_by(Brand.name)
                )
            ).all()
        )
        return CatalogMetaRead(taxonomy=taxonomy, brands=brands)

    async def list_products(
        self,
        session: AsyncSession,
        *,
        query: str | None,
        master_category: str | None,
        sub_category: str | None,
        article_type: str | None,
        brand: str | None,
        try_on_only: bool,
        sort: CatalogSort,
        offset: int,
        limit: int,
    ) -> CatalogPageRead:
        from_clause = (
            Product.__table__
            .join(Gender.__table__, Product.gender_id == Gender.id)
            .join(MasterCategory.__table__, Product.master_category_id == MasterCategory.id)
            .join(SubCategory.__table__, Product.sub_category_id == SubCategory.id)
            .join(ArticleType.__table__, Product.article_type_id == ArticleType.id)
            .join(Brand.__table__, Product.brand_id == Brand.id)
            .join(Season.__table__, Product.season_id == Season.id)
        )
        filters = self._filters(
            query=query,
            master_category=master_category,
            sub_category=sub_category,
            article_type=article_type,
            brand=brand,
            try_on_only=try_on_only,
        )

        total = int(
            await session.scalar(
                select(func.count(Product.id)).select_from(from_clause).where(*filters)
            )
            or 0
        )

        statement = (
            select(
                Product.id,
                Product.product_display_name,
                Product.price,
                Product.year,
                Product.usage,
                Gender.name.label("gender"),
                MasterCategory.name.label("master_category"),
                SubCategory.name.label("sub_category"),
                ArticleType.name.label("article_type"),
                Brand.name.label("brand"),
                Season.name.label("season"),
                Product.image_top,
                Product.image_back,
                Product.image_search,
                Product.image_default,
                Product.image_left,
                Product.image_front,
                Product.image_right,
            )
            .select_from(from_clause)
            .where(*filters)
        )
        statement = self._apply_sort(statement, sort, query)
        rows = (await session.execute(statement.offset(offset).limit(limit))).mappings().all()

        items = [
            CatalogProductRead(
                id=row["id"],
                product_display_name=row["product_display_name"],
                price=row["price"],
                year=row["year"],
                usage=_clean_optional(row["usage"]),
                gender=_clean_optional(row["gender"]),
                master_category=row["master_category"],
                sub_category=row["sub_category"],
                article_type=row["article_type"],
                brand=_clean_optional(row["brand"]),
                season=_clean_optional(row["season"]),
                has_try_on=_clean_optional(row["image_front"]) is not None,
                images=CatalogProductImagesRead(
                    top=_clean_optional(row["image_top"]),
                    back=_clean_optional(row["image_back"]),
                    search=_clean_optional(row["image_search"]),
                    default=_clean_optional(row["image_default"]),
                    left=_clean_optional(row["image_left"]),
                    front=_clean_optional(row["image_front"]),
                    right=_clean_optional(row["image_right"]),
                ),
            )
            for row in rows
        ]
        return CatalogPageRead(
            items=items,
            total=total,
            offset=offset,
            limit=limit,
            has_more=offset + len(items) < total,
        )

    async def list_visual_products(
        self,
        session: AsyncSession,
        *,
        image_search_features: list[dict[str, Any]],
        offset: int,
        limit: int,
    ) -> CatalogPageRead:
        return await session.run_sync(
            lambda sync_session: self._list_visual_products_sync(
                sync_session,
                image_search_features=image_search_features,
                offset=offset,
                limit=limit,
            )
        )

    def _list_visual_products_sync(
        self,
        session: Session,
        *,
        image_search_features: list[dict[str, Any]],
        offset: int,
        limit: int,
    ) -> CatalogPageRead:
        products = list(
            session.scalars(
                select(Product).options(
                    joinedload(Product.gender),
                    joinedload(Product.master_category),
                    joinedload(Product.sub_category),
                    joinedload(Product.article_type),
                    joinedload(Product.brand),
                    joinedload(Product.season),
                )
            ).all()
        )
        scores = score_products_by_image_similarity(session, image_search_features, products)
        ranked = sorted(
            ((score, product) for product in products if product.id in scores),
            key=lambda pair: (pair[0], -pair[1].id),
            reverse=True,
        )
        page = ranked[offset:offset + limit]
        return CatalogPageRead(
            items=[self._product_read_from_model(product) for _, product in page],
            total=len(ranked),
            offset=offset,
            limit=limit,
            has_more=offset + len(page) < len(ranked),
        )

    def _product_read_from_model(self, product: Product) -> CatalogProductRead:
        return CatalogProductRead(
            id=product.id,
            product_display_name=product.product_display_name,
            price=product.price,
            year=product.year,
            usage=_clean_optional(product.usage),
            gender=_clean_optional(product.gender.name if product.gender else None),
            master_category=product.master_category.name,
            sub_category=product.sub_category.name,
            article_type=product.article_type.name,
            brand=_clean_optional(product.brand.name if product.brand else None),
            season=_clean_optional(product.season.name if product.season else None),
            has_try_on=_clean_optional(product.image_front) is not None,
            images=CatalogProductImagesRead(
                top=_clean_optional(product.image_top),
                back=_clean_optional(product.image_back),
                search=_clean_optional(product.image_search),
                default=_clean_optional(product.image_default),
                left=_clean_optional(product.image_left),
                front=_clean_optional(product.image_front),
                right=_clean_optional(product.image_right),
            ),
        )

    def _filters(
        self,
        *,
        query: str | None,
        master_category: str | None,
        sub_category: str | None,
        article_type: str | None,
        brand: str | None,
        try_on_only: bool,
    ) -> list:
        filters = []
        if master_category:
            filters.append(MasterCategory.name == master_category)
        if sub_category:
            filters.append(SubCategory.name == sub_category)
        if article_type:
            filters.append(ArticleType.name == article_type)
        if brand:
            filters.append(Brand.name == brand)
        if try_on_only:
            filters.append(_valid_image(Product.image_front))

        for term in (query or "").split()[:8]:
            filters.append(
                or_(
                    Product.product_display_name.icontains(term, autoescape=True),
                    Brand.name.icontains(term, autoescape=True),
                    MasterCategory.name.icontains(term, autoescape=True),
                    SubCategory.name.icontains(term, autoescape=True),
                    ArticleType.name.icontains(term, autoescape=True),
                    Product.usage.icontains(term, autoescape=True),
                )
            )
        return filters

    def _apply_sort(
        self,
        statement: Select,
        sort: CatalogSort,
        query: str | None,
    ) -> Select:
        if sort == "newest":
            return statement.order_by(Product.year.is_(None), Product.year.desc(), Product.id.desc())
        if sort == "priceAsc":
            return statement.order_by(Product.price.asc(), Product.id.desc())
        if sort == "priceDesc":
            return statement.order_by(Product.price.desc(), Product.id.desc())
        if query:
            return statement.order_by(
                case(
                    (Product.product_display_name.icontains(query, autoescape=True), 0),
                    else_=1,
                ),
                Product.id.desc(),
            )
        return statement.order_by(Product.id.desc())

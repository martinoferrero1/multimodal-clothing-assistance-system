from __future__ import annotations

import asyncio

from infra.db.models.base import Base
from infra.db.models.catalog_models import (
    ArticleType,
    Brand,
    Color,
    Gender,
    MasterCategory,
    Product,
    Season,
    SubCategory,
)
from services.catalog_service import CatalogService
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


def test_catalog_meta_and_hierarchical_product_filters() -> None:
    async def exercise() -> None:
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)

        async with session_factory() as session:
            men = Gender(name="Men")
            apparel = MasterCategory(name="Apparel")
            topwear = SubCategory(name="Topwear", master_category=apparel)
            shirts = ArticleType(name="Shirts", sub_category=topwear)
            tshirts = ArticleType(name="Tshirts", sub_category=topwear)
            brand = Brand(name="North")
            season = Season(name="Summer")
            navy = Color(name="Navy")
            session.add_all(
                [
                    Product(
                        id=1,
                        product_display_name="North Oxford Shirt",
                        year=2024,
                        usage="Casual",
                        price=10,
                        gender=men,
                        master_category=apparel,
                        sub_category=topwear,
                        article_type=shirts,
                        brand=brand,
                        season=season,
                        base_colour=navy,
                        image_front="https://example.com/front.jpg",
                    ),
                    Product(
                        id=2,
                        product_display_name="North Basic Tee",
                        year=2025,
                        usage="Casual",
                        price=5,
                        gender=men,
                        master_category=apparel,
                        sub_category=topwear,
                        article_type=tshirts,
                        brand=brand,
                        season=season,
                        base_colour=navy,
                        image_front=None,
                    ),
                ]
            )
            await session.commit()

            service = CatalogService()
            meta = await service.get_meta(session)
            assert [item.name for item in meta.taxonomy] == ["Apparel"]
            assert [item.name for item in meta.taxonomy[0].subcategories] == ["Topwear"]
            assert meta.taxonomy[0].subcategories[0].article_types == ["Shirts", "Tshirts"]
            assert meta.brands == ["North"]

            page = await service.list_products(
                session,
                query="Oxford",
                master_category="Apparel",
                sub_category="Topwear",
                article_type="Shirts",
                brand="North",
                try_on_only=True,
                sort="relevance",
                offset=0,
                limit=12,
            )
            assert page.total == 1
            assert page.items[0].product_display_name == "North Oxford Shirt"
            assert page.items[0].has_try_on is True
            assert page.has_more is False

        await engine.dispose()

    asyncio.run(exercise())


def test_catalog_visual_search_orders_only_visual_matches(monkeypatch) -> None:
    async def exercise() -> None:
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)

        async with session_factory() as session:
            women = Gender(name="Women")
            apparel = MasterCategory(name="Apparel")
            topwear = SubCategory(name="Topwear", master_category=apparel)
            shirts = ArticleType(name="Shirts", sub_category=topwear)
            brand = Brand(name="North")
            season = Season(name="Summer")
            navy = Color(name="Navy")
            session.add_all(
                [
                    Product(
                        id=1,
                        product_display_name="First visual match",
                        gender=women,
                        master_category=apparel,
                        sub_category=topwear,
                        article_type=shirts,
                        brand=brand,
                        season=season,
                        base_colour=navy,
                        image_search="https://example.com/first.jpg",
                    ),
                    Product(
                        id=2,
                        product_display_name="Best visual match",
                        gender=women,
                        master_category=apparel,
                        sub_category=topwear,
                        article_type=shirts,
                        brand=brand,
                        season=season,
                        base_colour=navy,
                        image_search="https://example.com/best.jpg",
                    ),
                ]
            )
            await session.commit()

            page = await CatalogService().list_visual_products(
                session,
                image_search_features=[{"feature": [0.1]}],
                offset=0,
                limit=1,
            )
            assert [item.id for item in page.items] == [2]
            assert page.total == 2
            assert page.has_more is True

        await engine.dispose()

    monkeypatch.setattr(
        "services.catalog_service.score_products_by_image_similarity",
        lambda _session, _features, products: {product.id: float(product.id) for product in products},
    )
    asyncio.run(exercise())


def test_catalog_pagination_and_sorting() -> None:
    async def exercise() -> None:
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)

        async with session_factory() as session:
            women = Gender(name="Women")
            footwear = MasterCategory(name="Footwear")
            shoes = SubCategory(name="Shoes", master_category=footwear)
            casual = ArticleType(name="Casual Shoes", sub_category=shoes)
            brand = Brand(name="South")
            season = Season(name="Fall")
            black = Color(name="Black")
            for product_id, year, price in ((1, 2022, 20), (2, 2025, 30), (3, 2024, 10)):
                session.add(
                    Product(
                        id=product_id,
                        product_display_name=f"Shoe {product_id}",
                        year=year,
                        usage="Casual",
                        price=price,
                        gender=women,
                        master_category=footwear,
                        sub_category=shoes,
                        article_type=casual,
                        brand=brand,
                        season=season,
                        base_colour=black,
                    )
                )
            await session.commit()

            page = await CatalogService().list_products(
                session,
                query=None,
                master_category=None,
                sub_category=None,
                article_type=None,
                brand=None,
                try_on_only=False,
                sort="newest",
                offset=0,
                limit=2,
            )
            assert [item.id for item in page.items] == [2, 3]
            assert page.total == 3
            assert page.has_more is True

        await engine.dispose()

    asyncio.run(exercise())

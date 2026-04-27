from __future__ import annotations

import math
import unicodedata
from difflib import SequenceMatcher
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from infra.db.database import Database
from infra.db.models import Product
from schemas.outfit_maker.product_solicitation import GarmentSpec, ItemSpec, ItemSpecList, OutfitSpec
from utils.models import get_embedding_model


DEFAULT_OPTIONS_PER_ITEM = 8
PRODUCT_POOL_LIMIT: int | None = None
EMBEDDING_BATCH_SIZE = 96
SEMANTIC_WEIGHT = 8.0

_PRODUCT_EMBEDDING_CACHE: dict[int, tuple[str, list[float]]] = {}


def search_product_candidates(
    request: ItemSpecList | None,
    options_per_item: int = DEFAULT_OPTIONS_PER_ITEM,
) -> list[dict[str, Any]]:
    if request is None:
        return []

    with Database().get_session() as session:
        products = _load_product_pool(session)
        print(f"Loaded {len(products)} products from the database for candidate search.")
        return [
            _search_item(products, item, options_per_item)
            for item in request.items
        ]


def _search_item(
    products: list[Product],
    item: ItemSpec,
    options_per_item: int,
) -> dict[str, Any]:
    if isinstance(item, OutfitSpec):
        return {
            "kind": "outfit",
            "request": item.model_dump(exclude={"items"}),
            "items": [
                _search_garment(products, _merge_outfit_defaults(item, garment), options_per_item)
                for garment in item.items
            ],
        }

    return {
        "kind": "garment",
        **_search_garment(products, item, options_per_item),
    }


def _merge_outfit_defaults(outfit: OutfitSpec, garment: GarmentSpec) -> GarmentSpec:
    data = garment.model_dump()
    for field in (
        "usage",
        "years",
        "max_price",
        "gender",
        "brands",
        "seasons",
        "base_colors",
        "secondary_colors",
    ):
        if data.get(field) is None:
            data[field] = getattr(outfit, field)
    return GarmentSpec(**data)


def _search_garment(
    products: list[Product],
    garment: GarmentSpec,
    options_per_item: int,
) -> dict[str, Any]:
    semantic_query = _request_search_text(garment)
    semantic_scores = _semantic_similarity_scores(semantic_query, products)

    ranked = sorted(
        (
            (_score_product(product, garment, semantic_scores.get(product.id)), product)
            for product in products
        ),
        key=lambda pair: (
            pair[0],
            #pair[1].availability,
            -pair[1].price,
            -pair[1].id,
        ),
        reverse=True,
    )

    return {
        "request": garment.model_dump(),
        "semantic_query": semantic_query,
        "candidates": [
            _serialize_product(product, score)
            for score, product in ranked[:options_per_item]
        ],
    }


def _load_product_pool(session: Session) -> list[Product]:
    stmt = (
        select(Product)
        .options(
            joinedload(Product.gender),
            joinedload(Product.master_category),
            joinedload(Product.sub_category),
            joinedload(Product.article_type),
            joinedload(Product.brand),
            joinedload(Product.season),
            joinedload(Product.base_colour),
            joinedload(Product.colour1),
            joinedload(Product.colour2),
        )
        #.where(Product.availability > 0)
        #.order_by(Product.availability.desc(), Product.id.asc())
    )
    if PRODUCT_POOL_LIMIT is not None:
        stmt = stmt.limit(PRODUCT_POOL_LIMIT)
    return list(session.scalars(stmt).all())


def _score_product(
    product: Product,
    garment: GarmentSpec,
    semantic_score: float | None,
) -> float:
    score = 0.0

    if semantic_score is not None:
        score += semantic_score * SEMANTIC_WEIGHT
    else:
        score += _text_similarity(_request_search_text(garment), _product_search_text(product)) * SEMANTIC_WEIGHT

    score += _soft_match(garment.base_colors, [_name(product.base_colour)], 1.6)
    score += _soft_match(garment.secondary_colors, [_name(product.colour1), _name(product.colour2)], 1.0)
    score += _soft_match([garment.gender] if garment.gender else None, [_name(product.gender)], 0.9)
    score += _soft_match(garment.seasons, [_name(product.season)], 0.6)
    score += _year_score(garment.years, product.year) * 0.7
    score += _price_score(garment.max_price, product.price) * 0.9

    return round(score, 4)


def _semantic_similarity_scores(query: str, products: list[Product]) -> dict[int, float]:
    if not query:
        return {}

    try:
        embedding_model = get_embedding_model()
        query_embedding = _embed_query(embedding_model, query)
        product_embeddings = _get_product_embeddings(embedding_model, products)
    except Exception:
        return {}

    return {
        product_id: _cosine_similarity(query_embedding, product_embedding)
        for product_id, product_embedding in product_embeddings.items()
    }


def _get_product_embeddings(embedding_model, products: list[Product]) -> dict[int, list[float]]:
    missing_products: list[Product] = []
    for product in products:
        text = _product_search_text(product)
        cached = _PRODUCT_EMBEDDING_CACHE.get(product.id)
        if cached is None or cached[0] != text:
            missing_products.append(product)

    for start in range(0, len(missing_products), EMBEDDING_BATCH_SIZE):
        batch = missing_products[start:start + EMBEDDING_BATCH_SIZE]
        texts = [_product_search_text(product) for product in batch]
        embeddings = _embed_documents(embedding_model, texts)
        for product, text, embedding in zip(batch, texts, embeddings):
            _PRODUCT_EMBEDDING_CACHE[product.id] = (text, embedding)

    return {
        product.id: _PRODUCT_EMBEDDING_CACHE[product.id][1]
        for product in products
        if product.id in _PRODUCT_EMBEDDING_CACHE
    }


def _embed_query(embedding_model, text: str) -> list[float]:
    if hasattr(embedding_model, "embed_query"):
        return embedding_model.embed_query(text)
    return embedding_model.embed_documents([text])[0]


def _embed_documents(embedding_model, texts: list[str]) -> list[list[float]]:
    if hasattr(embedding_model, "embed_documents"):
        return embedding_model.embed_documents(texts)
    return [embedding_model.embed_query(text) for text in texts]


def _request_search_text(garment: GarmentSpec) -> str:
    values: list[str] = []
    for field_values in (
        garment.product_names,
        garment.usage and [garment.usage],
        garment.master_categories,
        garment.sub_categories,
        garment.article_types,
        garment.brands,
        garment.base_colors,
        garment.secondary_colors,
        garment.seasons,
        garment.gender and [garment.gender],
    ):
        if field_values:
            values.extend(str(value) for value in field_values if value)
    return _normalize(" ".join(values))


def _product_search_text(product: Product) -> str:
    values = [
        product.product_display_name,
        product.usage,
        _name(product.gender),
        _name(product.master_category),
        _name(product.sub_category),
        _name(product.article_type),
        _name(product.brand),
        _name(product.season),
        _name(product.base_colour),
        _name(product.colour1),
        _name(product.colour2),
    ]
    return _normalize(" ".join(value for value in values if value))


def _soft_match(
    requested_values: list[str] | None,
    product_values: list[str | None],
    weight: float,
) -> float:
    if not requested_values:
        return 0.0
    requested_text = _normalize(" ".join(requested_values))
    product_text = _normalize(" ".join(value for value in product_values if value))
    return _text_similarity(requested_text, product_text) * weight


def _text_similarity(left: str, right: str) -> float:
    left = _normalize(left)
    right = _normalize(right)
    if not left or not right:
        return 0.0
    if left in right or right in left:
        return 1.0
    return max(
        SequenceMatcher(None, left, right).ratio(),
        _token_overlap(left, right),
    )


def _token_overlap(left: str, right: str) -> float:
    left_tokens = set(left.split())
    right_tokens = set(right.split())
    if not left_tokens or not right_tokens:
        return 0.0
    return len(left_tokens & right_tokens) / len(left_tokens | right_tokens)


def _year_score(requested_years: list[int] | None, product_year: int | None) -> float:
    if not requested_years or product_year is None:
        return 0.0
    closest_distance = min(abs(product_year - requested_year) for requested_year in requested_years)
    return max(0.0, 1.0 - (closest_distance / 10))


def _price_score(max_price: float | None, product_price: float | None) -> float:
    if max_price is None or product_price is None:
        return 0.0
    if product_price <= max_price:
        return 1.0
    return max(0.0, 1.0 - ((product_price - max_price) / max_price))


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    dot_product = sum(left_value * right_value for left_value, right_value in zip(left, right))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return (dot_product / (left_norm * right_norm) + 1) / 2


def _normalize(value: str | None) -> str:
    if value is None:
        return ""
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    return " ".join(value.lower().replace("_", " ").replace("-", " ").split())


def _name(value: Any) -> str | None:
    return value.name if value is not None else None


def _serialize_product(product: Product, score: float) -> dict[str, Any]:
    return {
        "id": product.id,
        "product_display_name": product.product_display_name,
        "score": score,
        "price": product.price,
        #"availability": product.availability,
        "year": product.year,
        "usage": product.usage,
        "gender": _name(product.gender),
        "master_category": _name(product.master_category),
        "sub_category": _name(product.sub_category),
        "article_type": _name(product.article_type),
        "brand": _name(product.brand),
        "season": _name(product.season),
        "base_colour": _name(product.base_colour),
        "colour1": _name(product.colour1),
        "colour2": _name(product.colour2),
        "images": {
            "top": product.image_top,
            "back": product.image_back,
            "search": product.image_search,
            "default": product.image_default,
            "left": product.image_left,
            "front": product.image_front,
            "right": product.image_right,
        },
    }

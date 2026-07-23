from __future__ import annotations

import base64
import hashlib
import io
import json
import logging
import math
import urllib.request
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from core.metaclasses.singleton_meta import SingletonMeta
from core.settings import settings
from infra.db.models.catalog_models import Product, ProductEmbedding


logger = logging.getLogger(__name__)

IMAGE_FEATURE_IDENTIFIER = "visual:local-image-fingerprint-v1"
_PRODUCT_IMAGE_FEATURE_CACHE: dict[tuple[str, int], tuple[str, list[float]]] = {}


class ImageSimilarityService(metaclass=SingletonMeta):
    def extract_attachment_features(
        self,
        attachments: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        if settings.IMAGE_SEARCH_MODE != "visual_similarity":
            return []

        features: list[dict[str, Any]] = []
        for attachment in attachments:
            filename = str(attachment.get("filename") or "uploaded image")
            data_url = str(attachment.get("data_url") or "")
            if not data_url:
                continue

            try:
                features.append(
                    {
                        "filename": filename,
                        "feature_identifier": IMAGE_FEATURE_IDENTIFIER,
                        "feature": _image_feature_from_bytes(_decode_data_url(data_url)),
                    }
                )
            except Exception:
                logger.debug("Visual image feature extraction failed for %s", filename, exc_info=True)

        return features


def score_products_by_image_similarity(
    session: Session,
    query_features: list[dict[str, Any]] | None,
    products: list[Product],
) -> dict[int, float]:
    query_vectors: list[list[float]] = []
    for feature in query_features or []:
        try:
            raw_feature = feature.get("feature")
        except AttributeError:
            continue
        if not raw_feature:
            continue
        try:
            query_vectors.append(_coerce_feature_vector(raw_feature))
        except (TypeError, ValueError):
            logger.debug("Ignoring invalid visual query feature", exc_info=True)
    if not query_vectors or not products:
        return {}

    try:
        product_features = _get_product_image_features(session, products)
    except SQLAlchemyError:
        session.rollback()
        logger.debug("Persistent product image feature lookup failed", exc_info=True)
        return {}
    except Exception:
        logger.debug("Visual product similarity search failed", exc_info=True)
        return {}

    return {
        product_id: max(_cosine_similarity(query_vector, product_feature) for query_vector in query_vectors)
        for product_id, product_feature in product_features.items()
    }


def _get_product_image_features(
    session: Session,
    products: list[Product],
) -> dict[int, list[float]]:
    products_by_id = {product.id: product for product in products}
    product_urls = {
        product.id: image_url
        for product in products
        if (image_url := _product_image_url(product))
    }
    features: dict[int, list[float]] = {}
    missing_product_ids: list[int] = []
    product_ids_to_load: list[int] = []

    for product_id, image_url in product_urls.items():
        cache_key = (IMAGE_FEATURE_IDENTIFIER, product_id)
        cached = _PRODUCT_IMAGE_FEATURE_CACHE.get(cache_key)
        if cached is not None and cached[0] == image_url:
            features[product_id] = cached[1]
            continue
        product_ids_to_load.append(product_id)

    persisted_features = _load_persisted_product_features(session, product_ids_to_load)
    for product_id in product_ids_to_load:
        image_url = product_urls[product_id]
        url_hash = _stable_hash(image_url)
        persisted_feature = persisted_features.get(product_id)
        cache_key = (IMAGE_FEATURE_IDENTIFIER, product_id)

        if persisted_feature is not None and persisted_feature.source_text_hash == url_hash:
            try:
                feature = _deserialize_feature(persisted_feature.vector_json)
            except ValueError:
                logger.debug("Stored image feature for product %s is invalid", product_id, exc_info=True)
            else:
                _PRODUCT_IMAGE_FEATURE_CACHE[cache_key] = (image_url, feature)
                features[product_id] = feature
                continue

        missing_product_ids.append(product_id)

    for product_id in missing_product_ids:
        image_url = product_urls[product_id]
        try:
            feature = _image_feature_from_bytes(_download_image(image_url))
        except Exception:
            logger.debug("Could not extract image feature for product %s", product_id, exc_info=True)
            continue

        _PRODUCT_IMAGE_FEATURE_CACHE[(IMAGE_FEATURE_IDENTIFIER, product_id)] = (image_url, feature)
        features[product_id] = feature
        _upsert_product_feature(
            session=session,
            persisted_features=persisted_features,
            product_id=products_by_id[product_id].id,
            source_url_hash=_stable_hash(image_url),
            feature=feature,
        )

    if missing_product_ids:
        session.commit()

    return features


def _load_persisted_product_features(
    session: Session,
    product_ids: list[int],
) -> dict[int, ProductEmbedding]:
    if not product_ids:
        return {}

    rows = session.scalars(
        select(ProductEmbedding).where(
            ProductEmbedding.embedding_identifier == IMAGE_FEATURE_IDENTIFIER,
            ProductEmbedding.product_id.in_(product_ids),
        )
    ).all()
    return {row.product_id: row for row in rows}


def _upsert_product_feature(
    *,
    session: Session,
    persisted_features: dict[int, ProductEmbedding],
    product_id: int,
    source_url_hash: str,
    feature: list[float],
) -> None:
    vector_json = json.dumps(feature, separators=(",", ":"))
    persisted_feature = persisted_features.get(product_id)
    if persisted_feature is None:
        persisted_feature = ProductEmbedding(
            product_id=product_id,
            embedding_identifier=IMAGE_FEATURE_IDENTIFIER,
            source_text_hash=source_url_hash,
            vector_json=vector_json,
        )
        session.add(persisted_feature)
        persisted_features[product_id] = persisted_feature
        return

    persisted_feature.source_text_hash = source_url_hash
    persisted_feature.vector_json = vector_json


def _decode_data_url(data_url: str) -> bytes:
    if "," not in data_url:
        raise ValueError("Invalid data URL")
    header, payload = data_url.split(",", maxsplit=1)
    if ";base64" not in header.lower():
        raise ValueError("Image data URL must be base64 encoded")
    return base64.b64decode(payload, validate=True)


def _download_image(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(
        request,
        timeout=settings.IMAGE_VISUAL_SEARCH_FETCH_TIMEOUT_SECONDS,
    ) as response:
        data = response.read(settings.IMAGE_VISUAL_SEARCH_MAX_IMAGE_BYTES + 1)
    if len(data) > settings.IMAGE_VISUAL_SEARCH_MAX_IMAGE_BYTES:
        raise ValueError("Product image is too large")
    return data


def _image_feature_from_bytes(image_bytes: bytes) -> list[float]:
    from PIL import Image

    with Image.open(io.BytesIO(image_bytes)) as image:
        image = image.convert("RGB")
        vector = _color_histogram(image) + _thumbnail_pixels(image) + _average_hash(image)
    return _normalize_vector(vector)


def _color_histogram(image) -> list[float]:
    histogram_image = image.resize((64, 64))
    raw_histogram = histogram_image.histogram()
    vector: list[float] = []
    for channel in range(3):
        channel_values = raw_histogram[channel * 256:(channel + 1) * 256]
        total = sum(channel_values) or 1
        for start in range(0, 256, 16):
            vector.append(sum(channel_values[start:start + 16]) / total)
    return vector


def _thumbnail_pixels(image) -> list[float]:
    thumbnail = image.resize((8, 8))
    values: list[float] = []
    for red, green, blue in thumbnail.getdata():
        values.extend((red / 255.0, green / 255.0, blue / 255.0))
    return values


def _average_hash(image) -> list[float]:
    grayscale = image.convert("L").resize((8, 8))
    pixels = [float(value) for value in grayscale.getdata()]
    average = sum(pixels) / len(pixels)
    return [1.0 if value >= average else 0.0 for value in pixels]


def _product_image_url(product: Product) -> str | None:
    for value in (
        product.image_search,
        product.image_default,
        product.image_front,
        product.image_top,
        product.image_left,
        product.image_right,
        product.image_back,
    ):
        image_url = _clean_url(value)
        if image_url:
            return image_url
    return None


def _clean_url(value: Any) -> str | None:
    if value is None:
        return None
    image_url = str(value).strip()
    if not image_url or image_url.lower() in {"nan", "none", "null"}:
        return None
    return image_url


def _deserialize_feature(value: str) -> list[float]:
    decoded = json.loads(value)
    if not isinstance(decoded, list):
        raise ValueError("Stored image feature must be a list")
    return _coerce_feature_vector(decoded)


def _coerce_feature_vector(feature: Any) -> list[float]:
    if hasattr(feature, "tolist"):
        feature = feature.tolist()
    return [float(value) for value in feature]


def _normalize_vector(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [value / norm for value in vector]


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    dot_product = sum(left_value * right_value for left_value, right_value in zip(left, right))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return max(0.0, min(1.0, dot_product / (left_norm * right_norm)))


def _stable_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()

from __future__ import annotations

import base64
import io
import logging
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from PIL import Image

import services.image_similarity_service as image_similarity_service
from services.image_similarity_service import (
    IMAGE_FEATURE_IDENTIFIER,
    ImageSimilarityService,
    _cosine_similarity,
    _image_feature_from_bytes,
)
from services.catalog_image_fetcher import CatalogImageFetchError


def _png_bytes(color: tuple[int, int, int]) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (16, 16), color=color).save(buffer, format="PNG")
    return buffer.getvalue()


def _data_url(image_bytes: bytes) -> str:
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return f"data:image/png;base64,{encoded}"


class ImageSimilarityServiceTest(unittest.TestCase):
    def test_extracts_features_only_in_visual_similarity_mode(self) -> None:
        image_bytes = _png_bytes((255, 0, 0))
        attachment = {"filename": "shirt.png", "data_url": _data_url(image_bytes)}

        with patch.object(image_similarity_service.settings, "IMAGE_SEARCH_MODE", "characteristics"):
            self.assertEqual(ImageSimilarityService().extract_attachment_features([attachment]), [])

        with patch.object(image_similarity_service.settings, "IMAGE_SEARCH_MODE", "visual_similarity"):
            features = ImageSimilarityService().extract_attachment_features([attachment])

        self.assertEqual(features[0]["filename"], "shirt.png")
        self.assertEqual(features[0]["feature_identifier"], IMAGE_FEATURE_IDENTIFIER)
        self.assertGreater(len(features[0]["feature"]), 0)

    def test_image_features_score_identical_images_above_different_images(self) -> None:
        red_feature = _image_feature_from_bytes(_png_bytes((255, 0, 0)))
        red_copy_feature = _image_feature_from_bytes(_png_bytes((255, 0, 0)))
        blue_feature = _image_feature_from_bytes(_png_bytes((0, 0, 255)))

        same_score = _cosine_similarity(red_feature, red_copy_feature)
        different_score = _cosine_similarity(red_feature, blue_feature)

        self.assertGreater(same_score, different_score)


def test_all_catalog_fetches_fail_without_exposing_sensitive_urls(monkeypatch, caplog) -> None:
    class EmptyScalars:
        def all(self):
            return []

    class Session:
        commits = 0

        def scalars(self, statement):
            return EmptyScalars()

        def commit(self):
            self.commits += 1

        def rollback(self):
            pytest.fail("a catalog rejection must not roll back the search session")

        def add(self, value):
            pytest.fail("a rejected image must not persist a feature")

    product = SimpleNamespace(
        id=7,
        image_search="https://user:secret@catalog.example/private.png?token=sensitive",
        image_default=None,
        image_front=None,
        image_top=None,
        image_left=None,
        image_right=None,
        image_back=None,
    )
    session = Session()
    image_similarity_service._PRODUCT_IMAGE_FEATURE_CACHE.clear()
    monkeypatch.setattr(
        image_similarity_service,
        "fetch_catalog_image",
        lambda url: (_ for _ in ()).throw(CatalogImageFetchError("invalid_url")),
    )

    with caplog.at_level(logging.DEBUG, logger="services.image_similarity_service"):
        scores = image_similarity_service.score_products_by_image_similarity(
            session,
            [{"feature": [1.0]}],
            [product],
        )

    assert scores == {}
    assert session.commits == 1
    assert "invalid_url" in caplog.text
    assert "product 7" in caplog.text
    assert "secret" not in caplog.text
    assert "token=" not in caplog.text


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import unittest

from schemas.outfit_maker.recommendation_response import FinalResponseDraftSection, RecommendationBundle
from services.final_response_service import FinalResponseService
from services.outfit_recommendation_service import OutfitRecommendationService


def _product(product_id: int, name: str) -> dict:
    return {
        "id": product_id,
        "product_display_name": name,
        "score": 1.0,
    }


class OutfitRecommendationServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.service = OutfitRecommendationService()

    def test_empty_outfit_candidate_is_not_exposed(self) -> None:
        bundle = self.service.build_recommendation_bundle(
            [{"kind": "outfit", "request": {}, "items": []}]
        )

        self.assertEqual(bundle.outfits, [])
        self.assertEqual(bundle.product_highlights, [])

    def test_incomplete_outfit_candidate_is_not_exposed(self) -> None:
        bundle = self.service.build_recommendation_bundle(
            [
                {
                    "kind": "outfit",
                    "request": {"usage": "casual"},
                    "items": [
                        {
                            "request": {"article_types": ["Tshirts"]},
                            "candidates": [_product(1, "Green T-shirt")],
                        },
                        {
                            "request": {"article_types": ["Jeans"]},
                            "candidates": [],
                        },
                    ],
                }
            ]
        )

        self.assertEqual(bundle.outfits, [])

    def test_complete_outfit_candidate_is_exposed(self) -> None:
        bundle = self.service.build_recommendation_bundle(
            [
                {
                    "kind": "outfit",
                    "request": {"usage": "casual"},
                    "items": [
                        {
                            "request": {"article_types": ["Tshirts"]},
                            "candidates": [_product(1, "Green T-shirt")],
                        },
                        {
                            "request": {"article_types": ["Jeans"]},
                            "candidates": [_product(2, "Blue Jeans")],
                        },
                    ],
                }
            ]
        )

        self.assertEqual(len(bundle.outfits), 1)
        self.assertEqual(len(bundle.outfits[0].items), 2)

    def test_clarification_response_never_keeps_recommendation_placeholders(self) -> None:
        sections = FinalResponseService()._normalize_final_response_sections(
            draft_sections=[
                FinalResponseDraftSection(
                    type="text",
                    content="¿Para qué ocasión o estilo te gustaría el outfit?",
                ),
                FinalResponseDraftSection(type="outfit_recommendations"),
            ],
            recommendations=RecommendationBundle(),
            business_answer_texts=[],
            request_needs_clarification=True,
        )

        self.assertEqual(len(sections), 1)
        self.assertEqual(sections[0].type, "text")


if __name__ == "__main__":
    unittest.main()

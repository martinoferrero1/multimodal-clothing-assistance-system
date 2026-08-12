from __future__ import annotations

import unittest
from dataclasses import dataclass

from infra.db.product_search import _priority_filtered_products
from schemas.outfit_maker.product_solicitation import GarmentSpec, ItemSpecList, OutfitSpec
from services.outfit_request_service import OutfitRequestService


class OutfitRequestServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.service = OutfitRequestService()

    def test_empty_extraction_requires_clarification(self) -> None:
        prepared, needs_clarification = self.service.prepare_request(ItemSpecList(items=[]))

        self.assertTrue(needs_clarification)
        self.assertEqual(prepared.items, [])

    def test_generic_spanish_message_is_clarified_without_preferences(self) -> None:
        clarification = self.service.generic_request_clarification("Quiero un outfit")

        self.assertEqual(
            clarification,
            "Claro. ¿Para qué ocasión o qué estilo te gustaría el outfit?",
        )

    def test_generic_english_message_is_clarified_without_preferences(self) -> None:
        clarification = self.service.generic_request_clarification("I want an outfit, please")

        self.assertEqual(
            clarification,
            "Sure. What occasion or style would you like the outfit for?",
        )

    def test_actionable_message_is_not_intercepted(self) -> None:
        clarification = self.service.generic_request_clarification(
            "Quiero un outfit verde para una fiesta"
        )

        self.assertIsNone(clarification)

    def test_generic_message_with_preferences_continues_to_planner(self) -> None:
        clarification = self.service.generic_request_clarification(
            "Quiero un outfit",
            {
                "enabled": True,
                "guidance": ["User generally prefers green."],
            },
        )

        self.assertIsNone(clarification)

    def test_generic_outfit_without_preferences_requires_clarification(self) -> None:
        request = ItemSpecList(items=[OutfitSpec(items=[])])

        prepared, needs_clarification = self.service.prepare_request(request)

        self.assertTrue(needs_clarification)
        self.assertEqual(prepared.items, [])

    def test_generic_outfit_uses_sensible_core_slots_when_preferences_exist(self) -> None:
        request = ItemSpecList(items=[OutfitSpec(items=[])])
        style_context = {
            "enabled": True,
            "guidance": ["User generally prefers green."],
        }

        prepared, needs_clarification = self.service.prepare_request(request, style_context)

        self.assertFalse(needs_clarification)
        outfit = prepared.items[0]
        self.assertIsInstance(outfit, OutfitSpec)
        self.assertEqual(
            [garment.sub_categories for garment in outfit.items],
            [["Topwear"], ["Bottomwear"], ["Shoes"]],
        )

    def test_explicit_outfit_direction_is_enough_to_fill_core_slots(self) -> None:
        request = ItemSpecList(items=[OutfitSpec(base_colors=["green"], items=[])])

        prepared, needs_clarification = self.service.prepare_request(request)

        self.assertFalse(needs_clarification)
        outfit = prepared.items[0]
        self.assertEqual(outfit.base_colors, ["green"])
        self.assertEqual(len(outfit.items), 3)

    def test_duplicate_bottoms_are_reduced_to_one_compatible_slot(self) -> None:
        request = ItemSpecList(
            items=[
                OutfitSpec(
                    usage="casual",
                    items=[
                        GarmentSpec(article_types=["Jeans"]),
                        GarmentSpec(article_types=["Trousers"]),
                    ],
                )
            ]
        )

        prepared, needs_clarification = self.service.prepare_request(request)

        self.assertFalse(needs_clarification)
        outfit = prepared.items[0]
        bottom_items = [
            garment
            for garment in outfit.items
            if garment.sub_categories == ["Bottomwear"]
        ]
        self.assertEqual(len(bottom_items), 1)
        self.assertEqual(len(outfit.items), 3)

    def test_one_piece_outfit_adds_footwear_without_top_or_bottom(self) -> None:
        request = ItemSpecList(
            items=[
                OutfitSpec(
                    usage="formal",
                    items=[
                        GarmentSpec(
                            master_categories=["Apparel"],
                            sub_categories=["Dress"],
                            article_types=["Dresses"],
                        )
                    ],
                )
            ]
        )

        prepared, needs_clarification = self.service.prepare_request(request)

        self.assertFalse(needs_clarification)
        outfit = prepared.items[0]
        self.assertEqual(
            [garment.sub_categories for garment in outfit.items],
            [["Dress"], ["Shoes"]],
        )

    def test_structural_slot_filters_out_products_from_other_categories(self) -> None:
        @dataclass
        class _Category:
            name: str

        @dataclass
        class _Product:
            master_category: _Category
            sub_category: _Category
            article_type: _Category

        top = _Product(_Category("Apparel"), _Category("Topwear"), _Category("Tshirts"))
        trousers = _Product(_Category("Apparel"), _Category("Bottomwear"), _Category("Trousers"))
        slot = GarmentSpec(
            master_categories=["Apparel"],
            sub_categories=["Bottomwear"],
        )

        matches = _priority_filtered_products([top, trousers], slot, ["category"])

        self.assertEqual(matches, [trousers])


if __name__ == "__main__":
    unittest.main()

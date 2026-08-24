from __future__ import annotations

import unittest
from dataclasses import dataclass
from unittest.mock import patch

import infra.db.product_search as product_search
from infra.db.product_search import _select_ranked_products


@dataclass
class _Product:
    id: int
    price: float


class ProductSearchVisualRankingTest(unittest.TestCase):
    def test_visual_similarity_scores_entire_ranked_pool_not_only_text_top_slice(self) -> None:
        text_match = _Product(id=1, price=10.0)
        other_text_match = _Product(id=2, price=20.0)
        visual_match = _Product(id=3, price=30.0)
        ranked = [
            (9.0, text_match),
            (8.0, other_text_match),
            (0.0, visual_match),
        ]

        with patch.object(product_search.settings, "IMAGE_SEARCH_MODE", "visual_similarity"), patch.object(
            product_search.settings,
            "IMAGE_VISUAL_SEARCH_WEIGHT",
            10.0,
        ), patch(
            "infra.db.product_search.score_products_by_image_similarity",
            return_value={text_match.id: 0.0, other_text_match.id: 0.0, visual_match.id: 1.0},
        ) as score_products:
            selected = _select_ranked_products(
                session=object(),
                ranked=ranked,
                image_search_features=[{"feature": [1.0]}],
                limit=2,
            )

        scored_products = score_products.call_args.args[2]
        self.assertEqual([product.id for product in scored_products], [1, 2, 3])
        self.assertEqual([product.id for _, product in selected], [3, 1])

    def test_all_visual_fetches_fail_preserves_fallback_ranking(self) -> None:
        visual_first = _Product(id=1, price=10.0)
        fallback_first = _Product(id=2, price=20.0)
        ranked = [(9.0, visual_first), (8.0, fallback_first)]
        fallback_ranked = [(7.0, fallback_first), (6.0, visual_first)]

        with patch.object(product_search.settings, "IMAGE_SEARCH_MODE", "visual_similarity"), patch(
            "infra.db.product_search.score_products_by_image_similarity",
            return_value={},
        ):
            selected = _select_ranked_products(
                session=object(),
                ranked=ranked,
                fallback_ranked=fallback_ranked,
                image_search_features=[{"feature": [1.0]}],
                limit=2,
            )

        self.assertEqual([product.id for _, product in selected], [2, 1])


if __name__ == "__main__":
    unittest.main()

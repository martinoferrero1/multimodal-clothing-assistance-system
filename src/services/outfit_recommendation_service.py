from typing import Any

from core.metaclasses.singleton_meta import SingletonMeta
from schemas.outfit_maker.product_solicitation import GarmentSpec, OutfitSpec
from schemas.outfit_maker.recommendation_response import (
    GarmentRecommendation,
    OutfitRecommendation,
    ProductRecommendation,
    RecommendationBundle,
)


class OutfitRecommendationService(metaclass=SingletonMeta):
    def build_recommendation_bundle(
        self,
        product_candidates: list[dict[str, Any]],
    ) -> RecommendationBundle:
        garments: list[GarmentRecommendation] = []
        outfits: list[OutfitRecommendation] = []

        for item in product_candidates:
            if item.get("kind") == "outfit":
                outfits.append(self._build_outfit_recommendation(item))
                continue
            garments.append(self._build_garment_recommendation(item))

        return RecommendationBundle(garments=garments, outfits=outfits)

    def _build_outfit_recommendation(self, outfit_candidate: dict[str, Any]) -> OutfitRecommendation:
        selected_items = [
            self._build_garment_recommendation(garment_candidate)
            for garment_candidate in outfit_candidate.get("items", [])
        ]
        outfit_request_data = dict(outfit_candidate.get("request") or {})
        outfit_request_data["kind"] = "outfit"
        outfit_request_data["items"] = [
            garment_candidate.get("request", {})
            for garment_candidate in outfit_candidate.get("items", [])
        ]
        request = OutfitSpec(**outfit_request_data)
        return OutfitRecommendation(
            request=request,
            items=selected_items,
            summary_label=self._build_outfit_label(request),
        )

    def _build_garment_recommendation(
        self,
        garment_candidate: dict[str, Any],
    ) -> GarmentRecommendation:
        request = GarmentSpec(**garment_candidate.get("request", {}))
        candidates = garment_candidate.get("candidates", []) or []
        best_match = self._build_product_recommendation(candidates[0]) if candidates else None

        return GarmentRecommendation(
            request=request,
            best_match=best_match,
            total_candidates=len(candidates),
            summary_label=self._build_garment_label(request, best_match),
        )

    def _build_product_recommendation(
        self,
        product_data: dict[str, Any],
    ) -> ProductRecommendation:
        return ProductRecommendation(**product_data)

    def _build_garment_label(
        self,
        request: GarmentSpec,
        best_match: ProductRecommendation | None,
    ) -> str:
        article_type = self._first_value(request.article_types)
        product_name = self._first_value(request.product_names)
        base_color = self._first_value(request.base_colors)

        if product_name:
            label = product_name
        elif article_type:
            label = article_type
        elif best_match and best_match.article_type:
            label = best_match.article_type
        else:
            label = "Garment"

        if base_color:
            return f"{base_color} {label}".strip()
        return label.strip()

    def _build_outfit_label(self, request: OutfitSpec) -> str:
        usage = request.usage
        season = self._first_value(request.seasons)

        if usage and season:
            return f"{season} {usage} outfit"
        if usage:
            return f"{usage} outfit"
        if season:
            return f"{season} outfit"
        return "Outfit recommendation"

    def _first_value(self, values: list[str] | None) -> str | None:
        if not values:
            return None
        return values[0]

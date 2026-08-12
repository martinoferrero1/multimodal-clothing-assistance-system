from typing import Any

from core.metaclasses.singleton_meta import SingletonMeta
from schemas.outfit_maker.product_solicitation import GarmentSpec, OutfitSpec
from schemas.outfit_maker.recommendation_response import (
    GarmentRecommendation,
    OutfitRecommendation,
    ProductHighlightGroup,
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
                outfit = self._build_outfit_recommendation(item)
                if outfit is not None:
                    outfits.append(outfit)
                continue
            garments.append(self._build_garment_recommendation(item))

        product_highlights = self._build_product_highlight_groups(
            [*garments, *(garment for outfit in outfits for garment in outfit.items)]
        )

        return RecommendationBundle(
            garments=garments,
            outfits=outfits,
            product_highlights=product_highlights,
        )

    def _build_outfit_recommendation(
        self,
        outfit_candidate: dict[str, Any],
    ) -> OutfitRecommendation | None:
        raw_items = outfit_candidate.get("items", []) or []
        if not raw_items:
            return None

        selected_items = [
            self._build_garment_recommendation(garment_candidate)
            for garment_candidate in raw_items
        ]
        if not selected_items or any(item.best_match is None for item in selected_items):
            return None

        outfit_request_data = dict(outfit_candidate.get("request") or {})
        outfit_request_data["kind"] = "outfit"
        outfit_request_data["items"] = [
            garment_candidate.get("request", {})
            for garment_candidate in raw_items
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
        product_highlights = [
            self._build_product_recommendation(candidate)
            for candidate in candidates
        ]
        best_match = product_highlights[0] if product_highlights else None
        garment_type_label = self._build_garment_type_label(request, best_match)

        return GarmentRecommendation(
            request=request,
            best_match=best_match,
            product_highlights=product_highlights,
            garment_type_label=garment_type_label,
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

    def _build_product_highlight_groups(
        self,
        garments: list[GarmentRecommendation],
    ) -> list[ProductHighlightGroup]:
        grouped_products: dict[str, dict[str, Any]] = {}

        for garment in garments:
            if not garment.product_highlights:
                continue

            group_key = garment.garment_type_label.strip().lower() or garment.summary_label.strip().lower()
            if group_key not in grouped_products:
                grouped_products[group_key] = {
                    "label": garment.garment_type_label or garment.summary_label,
                    "products_by_id": {},
                }

            products_by_id: dict[int, ProductRecommendation] = grouped_products[group_key]["products_by_id"]
            for product in garment.product_highlights:
                current = products_by_id.get(product.id)
                if current is None or product.score > current.score:
                    products_by_id[product.id] = product

        highlight_groups: list[ProductHighlightGroup] = []
        for group in grouped_products.values():
            products = sorted(
                group["products_by_id"].values(),
                key=lambda product: (product.score, product.id),
                reverse=True,
            )[:8]
            if not products:
                continue
            highlight_groups.append(
                ProductHighlightGroup(
                    group_label=group["label"],
                    products=products,
                )
            )

        return highlight_groups

    def _build_garment_type_label(
        self,
        request: GarmentSpec,
        best_match: ProductRecommendation | None,
    ) -> str:
        article_type = self._first_value(request.article_types)
        sub_category = self._first_value(request.sub_categories)
        master_category = self._first_value(request.master_categories)
        product_name = self._first_value(request.product_names)

        return (
            article_type
            or (best_match.article_type if best_match and best_match.article_type else None)
            or sub_category
            or (best_match.sub_category if best_match and best_match.sub_category else None)
            or master_category
            or (best_match.master_category if best_match and best_match.master_category else None)
            or product_name
            or "Garment"
        ).strip()

    def _first_value(self, values: list[str] | None) -> str | None:
        if not values:
            return None
        return values[0]

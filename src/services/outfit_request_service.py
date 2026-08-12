from __future__ import annotations

import re
import unicodedata
from typing import Any

from schemas.outfit_maker.product_solicitation import GarmentSpec, ItemSpecList, OutfitSpec


_ONE_PIECE_ARTICLE_TYPES = {
    "clothing set",
    "dresses",
    "jumpsuit",
    "kurta sets",
    "lehenga choli",
    "rompers",
    "suits",
}
_OUTERWEAR_ARTICLE_TYPES = {
    "blazers",
    "jackets",
    "nehru jackets",
    "rain jacket",
    "shrug",
    "sweaters",
    "sweatshirts",
    "waistcoat",
}
_EXCLUSIVE_ROLES = {"top", "outerwear", "bottom", "one_piece", "footwear"}
_OUTFIT_NOUNS = {"conjunto", "look", "outfit"}
_GENERIC_OUTFIT_WORDS = {
    "a",
    "algo",
    "algun",
    "alguno",
    "an",
    "armame",
    "armar",
    "build",
    "cualquiera",
    "dame",
    "favor",
    "give",
    "gustaria",
    "hazme",
    "i",
    "make",
    "me",
    "necesito",
    "need",
    "please",
    "podrias",
    "por",
    "quiero",
    "recommend",
    "recomendame",
    "some",
    "something",
    "un",
    "una",
    "want",
    "yo",
    *_OUTFIT_NOUNS,
}
_SPANISH_GENERIC_WORDS = {
    "algo",
    "algun",
    "alguno",
    "armame",
    "armar",
    "cualquiera",
    "conjunto",
    "dame",
    "favor",
    "gustaria",
    "hazme",
    "necesito",
    "podrias",
    "por",
    "quiero",
    "recomendame",
    "un",
    "una",
    "yo",
}


class OutfitRequestService:
    """Turns extracted outfit intent into searchable, compatible garment slots."""

    def generic_request_clarification(
        self,
        message: str,
        style_preference_context: dict[str, Any] | None = None,
    ) -> str | None:
        if self._has_style_guidance(style_preference_context or {}):
            return None

        words = set(self._normalized_words(message))
        if not words or not words.intersection(_OUTFIT_NOUNS):
            return None
        if not words.issubset(_GENERIC_OUTFIT_WORDS):
            return None

        if words.intersection(_SPANISH_GENERIC_WORDS):
            return "Claro. ¿Para qué ocasión o qué estilo te gustaría el outfit?"
        return "Sure. What occasion or style would you like the outfit for?"

    def prepare_request(
        self,
        request: ItemSpecList,
        style_preference_context: dict[str, Any] | None = None,
    ) -> tuple[ItemSpecList, bool]:
        if not request.items:
            return request, True

        prepared_items = []
        needs_clarification = False
        has_style_guidance = self._has_style_guidance(style_preference_context or {})

        for item in request.items:
            if not isinstance(item, OutfitSpec):
                prepared_items.append(item)
                continue

            if not item.items and not self._has_outfit_direction(item) and not has_style_guidance:
                needs_clarification = True
                continue

            item_data = item.model_dump(exclude={"items"})
            item_data["items"] = [
                garment.model_dump()
                for garment in self._complete_compatible_items(item.items)
            ]
            prepared_items.append(OutfitSpec(**item_data))

        if needs_clarification:
            return ItemSpecList(items=prepared_items), True

        return ItemSpecList(items=prepared_items), not prepared_items

    def _complete_compatible_items(self, garments: list[GarmentSpec]) -> list[GarmentSpec]:
        has_one_piece = any(self._garment_role(garment) == "one_piece" for garment in garments)
        selected: list[GarmentSpec] = []
        occupied_roles: set[str] = set()
        seen_signatures: set[tuple[str, str, str]] = set()

        for garment in garments:
            role = self._garment_role(garment)
            if has_one_piece and role in {"top", "bottom"}:
                continue
            if role in _EXCLUSIVE_ROLES and role in occupied_roles:
                continue

            signature = self._taxonomy_signature(garment)
            if signature != ("", "", "") and signature in seen_signatures:
                continue

            selected.append(garment)
            if role in _EXCLUSIVE_ROLES:
                occupied_roles.add(role)
            seen_signatures.add(signature)

        if "one_piece" not in occupied_roles:
            if "top" not in occupied_roles:
                selected.append(self._default_top())
                occupied_roles.add("top")
            if "bottom" not in occupied_roles:
                selected.append(self._default_bottom())
                occupied_roles.add("bottom")

        if "footwear" not in occupied_roles:
            selected.append(self._default_footwear())

        return selected

    def _garment_role(self, garment: GarmentSpec) -> str:
        master, sub_category, article_type = self._taxonomy_signature(garment)

        if article_type in _ONE_PIECE_ARTICLE_TYPES or sub_category in {
            "apparel set",
            "dress",
            "saree",
        }:
            return "one_piece"
        if master == "footwear":
            return "footwear"
        if sub_category == "bottomwear":
            return "bottom"
        if sub_category == "topwear":
            if article_type in _OUTERWEAR_ARTICLE_TYPES:
                return "outerwear"
            return "top"
        if sub_category == "socks":
            return "socks"
        return "other"

    def _taxonomy_signature(self, garment: GarmentSpec) -> tuple[str, str, str]:
        return (
            self._first_normalized(garment.master_categories),
            self._first_normalized(garment.sub_categories),
            self._first_normalized(garment.article_types),
        )

    def _first_normalized(self, values: list[str] | None) -> str:
        if not values:
            return ""
        return values[0].strip().casefold()

    def _has_outfit_direction(self, outfit: OutfitSpec) -> bool:
        return any(
            value not in (None, [], "")
            for value in (
                outfit.usage,
                outfit.years,
                outfit.max_price,
                outfit.gender,
                outfit.brands,
                outfit.seasons,
                outfit.base_colors,
                outfit.secondary_colors,
            )
        )

    def _has_style_guidance(self, context: dict[str, Any]) -> bool:
        guidance = context.get("guidance")
        return bool(context.get("enabled") and isinstance(guidance, list) and guidance)

    def _normalized_words(self, value: str) -> list[str]:
        normalized = unicodedata.normalize("NFKD", value)
        normalized = "".join(char for char in normalized if not unicodedata.combining(char))
        return re.findall(r"[a-z]+", normalized.casefold())

    def _default_top(self) -> GarmentSpec:
        return GarmentSpec(
            master_categories=["Apparel"],
            sub_categories=["Topwear"],
        )

    def _default_bottom(self) -> GarmentSpec:
        return GarmentSpec(
            master_categories=["Apparel"],
            sub_categories=["Bottomwear"],
        )

    def _default_footwear(self) -> GarmentSpec:
        return GarmentSpec(
            master_categories=["Footwear"],
            sub_categories=["Shoes"],
        )

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Optional, Literal, Union, Annotated
from utils.catalog_taxonomy import resolve_taxonomy_hierarchy

class BaseItemSpec(BaseModel):
    usage: Optional[str] = None
    years: Optional[List[int]] = None
    max_price: Optional[float] = None
    gender: Optional[str] = None
    brands: Optional[List[str]] = None
    seasons: Optional[List[str]] = None
    base_colors: Optional[List[str]] = None
    secondary_colors: Optional[List[str]] = None

class GarmentSpec(BaseItemSpec):
    kind: Literal["garment"] = "garment" # No subo el kind a BaseItemSpec porque en un principio lo abstrai pero por distintas cuestiones el modelo tenia problemas para discriminar el tipo de item

    master_categories: Optional[List[str]] = None
    sub_categories: Optional[List[str]] = None
    article_types: Optional[List[str]] = None
    product_names: Optional[List[str]] = None
    images: Optional[dict] = None

    @field_validator(
        "brands",
        "seasons",
        "base_colors",
        "secondary_colors",
        "master_categories",
        "sub_categories",
        "article_types",
        "product_names",
    )
    @classmethod
    def clean_string_lists(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value is None:
            return None

        cleaned: list[str] = []
        seen: set[str] = set()

        for item in value:
            normalized = item.strip()
            if not normalized:
                continue
            dedupe_key = normalized.casefold()
            if dedupe_key in seen:
                continue
            cleaned.append(normalized)
            seen.add(dedupe_key)

        return cleaned or None

    @model_validator(mode="after")
    def align_taxonomy_hierarchy(self):
        resolved = resolve_taxonomy_hierarchy(
            self.master_categories,
            self.sub_categories,
            self.article_types,
        )

        self.master_categories = [resolved.master_category] if resolved.master_category else None
        self.sub_categories = [resolved.sub_category] if resolved.sub_category else None
        self.article_types = [resolved.article_type] if resolved.article_type else None

        return self

class OutfitSpec(BaseItemSpec):
    kind: Literal["outfit"] = "outfit"

    items: List[GarmentSpec] = Field(
        description="Garments that compose the outfit"
    )

ItemSpec = Annotated[
    Union[GarmentSpec, OutfitSpec],
    Field(discriminator="kind")
]

class ItemSpecList(BaseModel):
    items: List[ItemSpec]

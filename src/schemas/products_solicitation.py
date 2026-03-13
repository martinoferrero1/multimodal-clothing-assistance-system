from __future__ import annotations

from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Union, Annotated

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
    kind: Literal["garment"] = "garment"

    master_categories: Optional[List[str]] = None
    sub_categories: Optional[List[str]] = None
    article_types: Optional[List[str]] = None
    product_names: Optional[List[str]] = None
    images: Optional[dict] = None

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
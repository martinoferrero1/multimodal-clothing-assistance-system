from __future__ import annotations
from pydantic import BaseModel, RootModel
from typing import List, Optional, Literal

class ItemSpec(BaseModel):
    kind: Literal["garment", "outfit"]

    usage: Optional[str] = None
    years: Optional[List[int]] = None
    max_price: Optional[float] = None
    gender: Optional[str] = None
    brands: Optional[List[str]] = None
    seasons: Optional[List[str]] = None
    base_colors: Optional[List[str]] = None
    secondary_colors: Optional[List[str]] = None

class GarmentSpec(ItemSpec):
    kind: Literal["garment"] = "garment"

    master_categories: Optional[List[str]] = None
    sub_categories: Optional[List[str]] = None
    article_types: Optional[List[str]] = None
    product_names: Optional[List[str]] = None
    images: Optional[dict] = None

class OutfitSpec(ItemSpec):
    kind: Literal["outfit"] = "outfit"
    items: List[ItemSpec]

class ItemSpecList(RootModel[List[ItemSpec]]):
    pass

ItemSpec.model_rebuild()

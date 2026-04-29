from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from schemas.outfit_maker.product_solicitation import GarmentSpec, OutfitSpec


class ProductRecommendation(BaseModel):
    id: int
    product_display_name: str
    score: float
    price: Optional[float] = None
    year: Optional[int] = None
    usage: Optional[str] = None
    gender: Optional[str] = None
    master_category: Optional[str] = None
    sub_category: Optional[str] = None
    article_type: Optional[str] = None
    brand: Optional[str] = None
    season: Optional[str] = None
    base_colour: Optional[str] = None
    colour1: Optional[str] = None
    colour2: Optional[str] = None
    images: Dict[str, Optional[str]] = Field(default_factory=dict)


class GarmentRecommendation(BaseModel):
    kind: Literal["garment"] = "garment"
    request: GarmentSpec
    best_match: Optional[ProductRecommendation] = None
    total_candidates: int = 0
    summary_label: str


class OutfitRecommendation(BaseModel):
    kind: Literal["outfit"] = "outfit"
    request: OutfitSpec
    items: List[GarmentRecommendation] = Field(default_factory=list)
    summary_label: str


class RecommendationBundle(BaseModel):
    garments: List[GarmentRecommendation] = Field(default_factory=list)
    outfits: List[OutfitRecommendation] = Field(default_factory=list)


class FinalResponseSection(BaseModel):
    type: Literal["text", "outfit_recommendations", "garment_recommendations"]
    content: Optional[str] = None
    title: Optional[str] = None


class FinalResponseDraftSection(BaseModel):
    type: Literal["text", "outfit_recommendations", "garment_recommendations"]
    content: Optional[str] = None
    title: Optional[str] = None


class FinalResponseDraft(BaseModel):
    sections: List[FinalResponseDraftSection] = Field(default_factory=list)


class FinalResponsePayload(BaseModel):
    message: str
    sections: List[FinalResponseSection] = Field(default_factory=list)
    recommendations: RecommendationBundle = Field(default_factory=RecommendationBundle)
    business_answer_texts: List[str] = Field(default_factory=list)

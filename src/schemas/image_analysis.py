from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class GarmentVisualFeatures(BaseModel):
    garment_type: str | None = Field(
        default=None,
        description="Visible garment type, such as shirt, dress, trousers, or shoes.",
    )
    dominant_colors: list[str] = Field(
        default_factory=list,
        description="Main colors visibly present in the garment.",
    )
    secondary_colors: list[str] = Field(
        default_factory=list,
        description="Secondary or accent colors visibly present in the garment.",
    )
    gender_presentation: str | None = Field(
        default=None,
        description="Apparent gender presentation only when visually supported.",
    )
    style: str | None = Field(default=None, description="Visible fashion style.")
    usage: str | None = Field(
        default=None,
        description="Likely use or occasion only when visually supported.",
    )
    season: str | None = Field(
        default=None,
        description="Apparent season suitability only when visually supported.",
    )
    pattern: str | None = Field(default=None, description="Visible pattern or print.")
    material: str | None = Field(
        default=None,
        description="Apparent material only when it can be inferred visually.",
    )
    fit: str | None = Field(default=None, description="Visible garment fit or silhouette.")
    notable_details: list[str] = Field(
        default_factory=list,
        description="Visible construction details, trims, closures, or other distinguishing features.",
    )
    brand_or_logo_text: str | None = Field(
        default=None,
        description="Brand or logo text only when it is clearly readable.",
    )


class ImageAnalysisResult(BaseModel):
    image_type: Literal[
        "single_garment",
        "outfit",
        "multiple_garments",
        "non_fashion",
        "unclear",
    ] = Field(description="The type of fashion content visible in the image.")
    garments: list[GarmentVisualFeatures] = Field(
        default_factory=list,
        description="One entry per visible garment, keeping each garment's attributes separate.",
    )
    summary: str = Field(
        description=(
            "A concise English description for product search containing only the "
            "visually supported characteristics represented above."
        ),
    )

from typing import Any
from schemas.products_solicitation import ItemSpecList
from shared.base_state import BaseState

class OutfitMakerState(BaseState):
    outfit_preferences: dict[str, Any]
    clothes_solicitations: ItemSpecList

class OutfitMakerStateKeys:
    OUTFIT_PREFERENCES = "outfit_preferences"
    CLOTHES_SOLICITATIONS = "clothes_solicitations"
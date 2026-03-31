from typing import Annotated, List
from schemas.outfit_maker.products_solicitation import ItemSpecList
from shared.base_state import BaseState
import operator

Preferences = Annotated[List[str], operator.add]

class OutfitMakerState(BaseState):
    outfit_preferences: Preferences
    cloth_solicitations: ItemSpecList

class OutfitMakerStateKeys:
    OUTFIT_PREFERENCES = "outfit_preferences"
    CLOTH_SOLICITATIONS = "cloth_solicitations"
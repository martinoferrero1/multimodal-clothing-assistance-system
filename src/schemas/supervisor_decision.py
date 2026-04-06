from pydantic import BaseModel, Field
from enum import Enum
from src.state import OUTFIT_EXPERT_KEY, CONSULTANT_EXPERT_KEY

class SpecialistType(str, Enum):
    OUTFIT_EXPERT = OUTFIT_EXPERT_KEY
    CONSULTANT_EXPERT = CONSULTANT_EXPERT_KEY

class SupervisorDecision(BaseModel):
    specialist: SpecialistType | None = Field(
        description="The specialist that the supervisor decides to execute based on the conversation history and the user's request. This can be null if the supervisor decides to answer the user directly, when the user's intent is unclear, or when the user request is out of the scope of the agent.")
    custom_answer: str | None = Field(
        description="A custom answer that the supervisor can give to the user.")
    use_default_clarification: bool = Field(
        description="Whether the supervisor finds the user request completely unintelligible and needs more information to process it.")
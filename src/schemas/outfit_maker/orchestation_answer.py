from pydantic import BaseModel, Field
from typing import Literal


class OrchestationAnswer(BaseModel):
    next_node: Literal["extract_cloth_solicitations", "search_clothes_in_db"] | None = Field(
        description="The next node to execute. This can be null if the agent prefers to answer the user directly, the intent is unclear, or when the user request is out of the scope of the agent and it needs to reject the request.")
    custom_answer: str | None = Field(
        description="A custom answer that the agent can give to the user.")
    unclear_msg: bool = Field(
        description="Whether the agent finds the user request unclear and needs more information to process it or if the user's intent is out of the scope of the agent. This can be used by the supervisor to decide whether to ask the user for clarification.")
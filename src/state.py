from typing import Annotated, List, Literal
from typing_extensions import TypedDict
from langchain_core.messages import BaseMessage
import operator
from schemas.outfit_maker.product_solicitation import ItemSpecList

MessagesState = Annotated[List[BaseMessage], operator.add]

class Error(TypedDict):
    node: str
    message: str
    type: str

ErrorState = Annotated[List[Error], operator.add]

class Summary(TypedDict):
    content: str
    pos_msgs_count: int

class State(TypedDict):
    messages: MessagesState
    errors: ErrorState
    previous_summary: Summary
    unclear_msg: bool
    cloth_solicitations: ItemSpecList | None
    current_specialist: Literal["outfit_expert", "consultant_expert"] | None

class StateKeys:
    MESSAGES = "messages"
    ERRORS = "errors"
    PREVIOUS_SUMMARY = "previous_summary"
    UNCLEAR_MSG = "unclear_msg"
    CLOTH_SOLICITATIONS = "cloth_solicitations"
    CURRENT_SPECIALIST = "current_specialist"

class SumaryKeys:
    CONTENT = "content"
    POS_MSGS_COUNT = "pos_msgs_count"

class ErrorKeys:
    NODE = "node"
    MESSAGE = "message"
    TYPE = "type"

OUTFIT_EXPERT_KEY = "outfit_expert"
CONSULTANT_EXPERT_KEY = "consultant_expert"
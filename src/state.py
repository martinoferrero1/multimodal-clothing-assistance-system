from typing import Annotated, List, Optional, TypedDict
from langchain_core.messages import BaseMessage
import operator
from schemas.business_qa import BusinessAnswer
from schemas.outfit_maker.product_solicitation import ItemSpecList
from schemas.outfit_maker.recommendation_response import (
    FinalResponsePayload,
    RecommendationBundle,
)
from schemas.orchestator_decision import NodeName

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

    # Information from the orchestator decision
    plan: List[NodeName]
    current_step_index: Optional[int]
    business_qa_queries: Optional[List[str]]
    outfit_search_intents: Optional[List[str]]

    # Outputs from later nodes
    business_answers: Optional[List[BusinessAnswer]]
    current_outfit_request: ItemSpecList | None
    product_candidates: Optional[List[dict]]
    current_outfit: RecommendationBundle | None
    final_answer: Optional[str]
    final_response_payload: FinalResponsePayload | None

class StateKeys:
    MESSAGES = "messages"
    ERRORS = "errors"
    PREVIOUS_SUMMARY = "previous_summary"
    UNCLEAR_MSG = "unclear_msg"
    PLAN = "plan"
    CURRENT_STEP_INDEX = "current_step_index"
    BUSINESS_QA_QUERIES = "business_qa_queries"
    OUTFIT_SEARCH_INTENTS = "outfit_search_intents"
    BUSINESS_ANSWERS = "business_answers"
    CURRENT_OUTFIT_REQUEST = "current_outfit_request"
    PRODUCT_CANDIDATES = "product_candidates"
    CURRENT_OUTFIT = "current_outfit"
    FINAL_ANSWER = "final_answer"
    FINAL_RESPONSE_PAYLOAD = "final_response_payload"


class SumaryKeys:
    CONTENT = "content"
    POS_MSGS_COUNT = "pos_msgs_count"

class ErrorKeys:
    NODE = "node"
    MESSAGE = "message"
    TYPE = "type"

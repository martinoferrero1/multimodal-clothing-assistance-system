from typing import Literal, TypedDict, Any
from shared.base_state import BaseState

OUTFIT_MAKER_FLOW_ID = "outfit_maker"
BUY_FLOW_ID = "buy"
ORDER_FLOW_ID = "order"

class FlowSnapshot(TypedDict):
    flow_id: Literal["outfit_maker", "buy", "order"] # el typed dict solo acepta literales en el tipado, por eso pongo las constantes por afuera
    thread_id: str
    awaiting_user_answer: bool

class SupervisorState(BaseState):
    flow_stack: list[FlowSnapshot]
    awaiting_new_intent_confirmation: bool
    evaluating_uncomprehended_msg: bool

class SupervisorStateKeys:
    FLOW_STACK = "flow_stack"
    AWAITING_NEW_INTENT_CONFIRMATION = "awaiting_new_intent_confirmation"
    EVALUATING_UNCOMPREHENDED_MSG = "evaluating_uncomprehended_msg"

class FlowSnapshotKeys:
    FLOW_ID = "flow_id"
    THREAD_ID = "thread_id"
    AWAITING_USER_ANSWER = "awaiting_user_answer"
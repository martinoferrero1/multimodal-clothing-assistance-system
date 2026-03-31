import operator
from typing import List, Literal
from typing_extensions import Annotated, TypedDict
from schemas.supervisor_decision import SupervisorDecision
from shared.base_state import BaseState

OUTFIT_MAKER_FLOW_ID = "outfit_expert"
BUY_FLOW_ID = "buy_expert"
ORDER_FLOW_ID = "order_expert"

class FlowSnapshot(TypedDict):
    flow_id: Literal["outfit_expert", "buy_expert", "order_expert"] # el typed dict solo acepta literales en el tipado, por eso pongo las constantes por afuera
    thread_id: str

FlowSnapshotState = Annotated[List[FlowSnapshot], lambda old, new: new] # dado que los snapshots tambien se eliminan, entonces no puedo usar operator.add

class SupervisorState(BaseState):
    flow_stack: FlowSnapshotState
    evaluating_uncomprehended_msg: bool

class SupervisorStateKeys:
    FLOW_STACK = "flow_stack"
    EVALUATING_UNCOMPREHENDED_MSG = "evaluating_uncomprehended_msg"

class FlowSnapshotKeys:
    FLOW_ID = "flow_id"
    THREAD_ID = "thread_id"
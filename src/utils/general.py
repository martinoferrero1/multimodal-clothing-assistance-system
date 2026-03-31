from agents.main_supervisor_agent.state import FlowSnapshotState, SupervisorState, SupervisorStateKeys, FlowSnapshotKeys
import uuid
from langgraph.graph.state import CompiledStateGraph
from shared.base_state import BaseStateKeys
from langchain_core.messages import AIMessage, BaseMessage
from typing import Any
from langgraph.types import Command


def normalize_text(text: str) -> str:
    try:
        return text.encode().decode("unicode_escape")
    except:
        return text
    
def run_expert_flow(state: SupervisorState, flow_id: str, graph: CompiledStateGraph, initialize_expert_state: callable) -> dict[str, Any]:
    stack = state[SupervisorStateKeys.FLOW_STACK]
    snapshot = None
    for s in reversed(stack):
        if s[FlowSnapshotKeys.FLOW_ID] == flow_id:
            snapshot = s
            break
    if snapshot is None:
        thread_id = str(uuid.uuid4())
        config = {"configurable": {"thread_id": thread_id}}
        snapshot = {
            FlowSnapshotKeys.FLOW_ID: flow_id,
            FlowSnapshotKeys.THREAD_ID: thread_id,
        }
        stack.append(snapshot)
        expert_state = initialize_expert_state()
        # concateno estado general para cualquier experto
        expert_state[BaseStateKeys.SETTINGS] = state[BaseStateKeys.SETTINGS]
        expert_state[BaseStateKeys.MESSAGES] = [next(
            msg
            for msg in reversed(state[BaseStateKeys.MESSAGES])
            if msg.type == "human"
        )]
        expert_state[BaseStateKeys.ERRORS] = []
        expert_state[BaseStateKeys.FINISHED] = False
    else:
        expert_state = {BaseStateKeys.MESSAGES: [state[BaseStateKeys.MESSAGES][-1]]}
        config = {"configurable": {"thread_id": snapshot[FlowSnapshotKeys.THREAD_ID]}}
    expert_result = graph.invoke(Command(update=expert_state), config=config)

    return process_expert_result(
        expert_finished=expert_result.get(BaseStateKeys.FINISHED, False),
        stack=stack,
        response=expert_result[BaseStateKeys.CURRENT_RESPONSE_MSG]
    )

def process_expert_result(expert_finished: bool, stack: FlowSnapshotState, response: BaseMessage) -> dict[str, Any]:
    if expert_finished:
        if stack:
            stack.pop()
            if stack:
                msg = AIMessage(
                    content="Your previous request finished. Which task would you like to continue?"
                )
                return {
                    BaseStateKeys.MESSAGES: [response, msg],
                    BaseStateKeys.CURRENT_RESPONSE_MSG: msg,
                    SupervisorStateKeys.EVALUATING_UNCOMPREHENDED_MSG: False,
                    SupervisorStateKeys.FLOW_STACK: stack # ya que si no la paso no actualiza en la memoria por mas que la referencia sea la misma, entonces se pierde la eliminacion
                }

        msg = AIMessage(
            content="Your request has been completed. How else can I assist you?"
        )
        return {
            BaseStateKeys.FINISHED: True,
            BaseStateKeys.MESSAGES: [response, msg],
            BaseStateKeys.CURRENT_RESPONSE_MSG: msg,
            SupervisorStateKeys.EVALUATING_UNCOMPREHENDED_MSG: False,
            SupervisorStateKeys.FLOW_STACK: []
        }

    if response:
        return {
            BaseStateKeys.MESSAGES: [response],
            BaseStateKeys.CURRENT_RESPONSE_MSG: response,
            SupervisorStateKeys.EVALUATING_UNCOMPREHENDED_MSG: False,
            SupervisorStateKeys.FLOW_STACK: stack
        }

    return {
        BaseStateKeys.CURRENT_RESPONSE_MSG: None,
        SupervisorStateKeys.EVALUATING_UNCOMPREHENDED_MSG: True,
        SupervisorStateKeys.FLOW_STACK: stack
    }
    
import json
from langchain_core.tools import tool
import uuid
from agents.main_supervisor_agent.state import SupervisorState, OUTFIT_MAKER_FLOW_ID, SupervisorStateKeys, FlowSnapshotKeys
from agents.outfit_maker_agent.state import OutfitMakerStateKeys
from agents.outfit_maker_agent.graph import OutfitMakerGraph
from shared.base_state import BaseStateKeys
from langgraph.graph.state import CompiledStateGraph

RESULT_CONTENT_KEY = "content"
RESULT_FINISHED_KEY = "finished"
RESULT_TOOL_KEY = "tool"

def run_expert_flow(state: SupervisorState, flow_id: str, graph: CompiledStateGraph, initialize_expert_state: callable) -> str:
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
        expert_state[BaseStateKeys.MESSAGES] = state[BaseStateKeys.MESSAGES][-1]
        expert_state[BaseStateKeys.ERRORS] = None
        expert_state[BaseStateKeys.FINISHED] = False
    else:
        config = {"configurable": {"thread_id": snapshot[FlowSnapshotKeys.THREAD_ID]}}
        expert_state = graph.get_state(config=config).values
        expert_state[BaseStateKeys.MESSAGES].append(state[BaseStateKeys.MESSAGES][-1]) # le paso el ultimo mensaje del usuario al experto
        graph.update_state(config=config, values=expert_state)

    total_expert_msgs_before = len(expert_state[BaseStateKeys.MESSAGES])
    result = graph.invoke(expert_state, config=config)

    return json.dumps({
        RESULT_CONTENT_KEY: result[BaseStateKeys.MESSAGES][-1].content if len(result[BaseStateKeys.MESSAGES]) > total_expert_msgs_before else None,
        RESULT_FINISHED_KEY: result.get(BaseStateKeys.FINISHED, False),
        RESULT_TOOL_KEY: flow_id
    })

@tool
def outfit_maker_expert_agent(state: SupervisorState) -> str:
    """
    Delegate the conversation to the outfit styling expert.
    """
    print("\nDelegating to Outfit Maker Expert Agent ---")
    graph = OutfitMakerGraph().get_graph()
    initialize_expert_state = lambda: {
        OutfitMakerStateKeys.OUTFIT_PREFERENCES: state[BaseStateKeys.MESSAGES][-1].content,
        OutfitMakerStateKeys.CLOTHES_SOLICITATIONS: None
    }

    return run_expert_flow(state, OUTFIT_MAKER_FLOW_ID, graph, initialize_expert_state)

@tool
def buy_expert_agent(state: SupervisorState) -> str:
    print("\nDelegating to Buy Expert Agent ---")
    # ESTE LO IMPLEMENTO MAS ADELANTE

    return None

@tool
def order_expert_agent(state: SupervisorState) -> str:
    print("\nDelegating to Order Expert Agent ---")
    # ESTE LO IMPLEMENTO MAS ADELANTE

    return None

@tool
def clarification_tool(state: SupervisorState) -> str:
    """
    Generates a message to the user asking them to clarify their request
    when the intent is unclear.
    """

    return json.dumps({
        RESULT_CONTENT_KEY: "I didn't understand your request. Could you please clarify what you want to do?",
        RESULT_FINISHED_KEY: False,
        RESULT_TOOL_KEY: "clarification"
    })

@tool
def end_conversation_tool(state: SupervisorState) -> str:
    """
    Generates a message to the user confirming the end of the conversation
    when the user explicitly wants to finish.
    """

    return json.dumps({
        RESULT_CONTENT_KEY: "Thank you! If you need more help, feel free to come back anytime.",
        RESULT_FINISHED_KEY: True,
        RESULT_TOOL_KEY: "end"
    })

supervisor_tools = [
    outfit_maker_expert_agent,
    buy_expert_agent,
    order_expert_agent,
    clarification_tool,
    end_conversation_tool
]
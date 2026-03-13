import json
from langgraph.prebuilt import InjectedState
from langchain_core.tools import tool
import uuid
from agents.main_supervisor_agent.state import SupervisorState, OUTFIT_MAKER_FLOW_ID, SupervisorStateKeys, FlowSnapshotKeys
from agents.outfit_maker_agent.state import OutfitMakerStateKeys
from agents.outfit_maker_agent.graph import OutfitMakerGraph
from shared.base_state import BaseStateKeys
from langgraph.graph.state import CompiledStateGraph
from typing import Annotated

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
        expert_state[BaseStateKeys.MESSAGES] = []
        expert_state[BaseStateKeys.ERRORS] = []
        expert_state[BaseStateKeys.FINISHED] = False
    else:
        config = {"configurable": {"thread_id": snapshot[FlowSnapshotKeys.THREAD_ID]}}
        expert_state = graph.get_state(config=config).values
        expert_state[BaseStateKeys.MESSAGES] += state[BaseStateKeys.MESSAGES][-1] # le paso el último mensaje del usuario al experto para que lo procese
        graph.update_state(config=config, values=expert_state)

    total_expert_msgs_before = len(expert_state[BaseStateKeys.MESSAGES])
    result = graph.invoke(expert_state, config=config)
    print(f"Resultado del experto {flow_id}: ", result)
    return json.dumps({
        RESULT_CONTENT_KEY: result[BaseStateKeys.MESSAGES][-1].content if len(result[BaseStateKeys.MESSAGES]) > total_expert_msgs_before else None,
        RESULT_FINISHED_KEY: result.get(BaseStateKeys.FINISHED, False),
        RESULT_TOOL_KEY: flow_id
    })

@tool
def outfit_maker_expert_agent(state: Annotated[SupervisorState, InjectedState]) -> str:
    """
    Delegate the user request to the outfit maker expert agent.

    Use this tool when the user wants help creating, combining, or choosing
    clothing outfits. This includes styling advice, outfit suggestions,
    or recommendations on how to combine garments for a specific occasion,
    season, or preference.
    """
    print("\nDelegating to Outfit Maker Expert Agent ---")
    graph = OutfitMakerGraph().get_graph()
    print("Estado del supervisor en la tool del outfit maker: ", state)
    initialize_expert_state = lambda: {
        OutfitMakerStateKeys.OUTFIT_PREFERENCES: next(
            msg.content
            for msg in reversed(state[BaseStateKeys.MESSAGES])
            if msg.type == "human"
        ),
        OutfitMakerStateKeys.CLOTHES_SOLICITATIONS: None
    }

    return run_expert_flow(state, OUTFIT_MAKER_FLOW_ID, graph, initialize_expert_state)

@tool
def buy_expert_agent(state: Annotated[SupervisorState, InjectedState]) -> str:
    """
    Delegate the user request to the buying expert agent.

    Use this tool when the user wants to purchase clothing items, find
    products to buy, or receive recommendations for items available for
    purchase.
    """
    print("\nDelegating to Buy Expert Agent ---")
    # ESTE LO IMPLEMENTO MAS ADELANTE

    return None

@tool
def order_expert_agent(state: Annotated[SupervisorState, InjectedState]) -> str:
    """
    Delegate the user request to the order management expert agent.

    Use this tool when the user asks about the status of an order, wants
    to track a purchase, review previous orders, cancel an order, or manage
    an existing purchase.
    """
    print("\nDelegating to Order Expert Agent ---")
    # ESTE LO IMPLEMENTO MAS ADELANTE

    return None

@tool
def clarification_tool(state: Annotated[SupervisorState, InjectedState]) -> str:
    """
    Ask the user to clarify their request.

    Use this tool when the user message is ambiguous, incomplete,
    or the supervisor cannot confidently determine which expert
    agent should handle the request.
    """

    return json.dumps({
        RESULT_CONTENT_KEY: "I didn't understand your request. Could you please clarify what you want to do?",
        RESULT_FINISHED_KEY: False,
        RESULT_TOOL_KEY: "clarification"
    })

@tool
def end_conversation_tool(state: Annotated[SupervisorState, InjectedState]) -> str:
    """
    End the conversation with the user.

    Use this tool when the user explicitly indicates that they want
    to finish the conversation, such as saying goodbye or confirming
    that they no longer need assistance.
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
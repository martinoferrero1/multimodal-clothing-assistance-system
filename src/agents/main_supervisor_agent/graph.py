from agents.base_graph import BaseGraph
from langgraph.graph import StateGraph, START, END
from langgraph.graph.state import CompiledStateGraph
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command
from agents.outfit_maker_agent.graph import OutfitMakerGraph
from agents.outfit_maker_agent.state import OutfitMakerStateKeys
from schemas.supervisor_decision import SupervisorDecision
from shared.base_state import BaseStateKeys
from utils.models import get_llm_model
from utils.error_handling import safe_node
from utils.prompts import build_prompt
from utils.general import run_expert_flow
from langchain_core.messages import AIMessage, SystemMessage
from .state import OUTFIT_MAKER_FLOW_ID, FlowSnapshotKeys, SupervisorState, SupervisorStateKeys
from typing import Literal

class SupervisorGraph(BaseGraph):

    @safe_node("route_from_start")
    def _route_from_start_node(self, state: SupervisorState) -> Command[Literal["decide_specialist", "call_outfit_expert", "call_buy_expert", "call_order_expert"]]:
        print("el estado en el route_from_start es: ", state)
        stack = state[SupervisorStateKeys.FLOW_STACK]
        next_node = "decide_specialist"
        if stack:
            last_snapshot = stack[-1]
            if state.get(SupervisorStateKeys.EVALUATING_UNCOMPREHENDED_MSG, False):
                next_node = last_snapshot.get(FlowSnapshotKeys.FLOW_ID, "decide_specialist")

        return Command(goto=next_node)
    
    @safe_node("ask_for_feedback")
    def _ask_for_feedback_node(self, state: SupervisorState):
        print("\nAsking for user feedback on the response ---")

        return {}

    @safe_node("decide_specialist")
    def _decide_specialist_node(self, state: SupervisorState) -> Command[Literal["call_outfit_expert", "call_buy_expert", "call_order_expert", "clarify_conversation", "end_conversation"]]:
        sys_prompt = build_prompt(
            base_prompt_path="src/prompts/supervisor/system_prompt.txt",
            examples_prompt_path="src/prompts/supervisor/examples_system_prompt.txt",
            include_examples=state[BaseStateKeys.SETTINGS].INCLUDE_PROMPT_EXAMPLES
        )
        supervisor_llm = get_llm_model(state[BaseStateKeys.SETTINGS], is_supervisor=True).with_structured_output(SupervisorDecision)
        messages = [SystemMessage(content=sys_prompt)] + state[BaseStateKeys.MESSAGES]
        response: SupervisorDecision = supervisor_llm.invoke(messages) # ya es un AI Message
        if response.action == "respond": # solo por ahora
            response.action = "end_conversation"

        return Command(goto=response.action, update={SupervisorStateKeys.EVALUATING_UNCOMPREHENDED_MSG: False})

    @safe_node("call_outfit_expert")
    def _call_outfit_expert_node(self, state: SupervisorState):
        """
        Delegate the user request to the outfit maker expert agent.

        It is used when the user wants help creating, combining, or choosing
        clothing outfits. This includes styling advice, outfit suggestions,
        or recommendations on how to combine garments for a specific occasion,
        season, or preference.
        """
        print("\nDelegating to Outfit Maker Expert Agent ---")
        graph = OutfitMakerGraph().get_graph()
        
        initialize_expert_state = lambda: {
            OutfitMakerStateKeys.OUTFIT_PREFERENCES: [],
            OutfitMakerStateKeys.CLOTH_SOLICITATIONS: None,
            OutfitMakerStateKeys.USER_CONFIRMATION: None
        }
        
        return run_expert_flow(state, OUTFIT_MAKER_FLOW_ID, graph, initialize_expert_state)

    @safe_node("call_buy_expert")
    def _call_buy_expert_node(self, state: SupervisorState):
        """
        Delegate the user request to the buying expert agent.

        It is used when the user wants to purchase clothing items, find
        products to buy, or receive recommendations for items available for
        purchase.
        """
        print("\nDelegating to Buy Expert Agent ---")
        # ESTE LO IMPLEMENTO DESPUES

        return {}
    
    @safe_node("call_order_expert")
    def _call_order_expert_node(self, state: SupervisorState):
        """
        Delegate the user request to the order management expert agent.

        It is used when the user asks about the status of an order, wants
        to track a purchase, review previous orders, cancel an order, or manage
        an existing purchase.
        """
        print("\nDelegating to Order Expert Agent ---")
        # ESTE LO IMPLEMENTO DESPUES

        return {}
    
    @safe_node("clarify_conversation")
    def _clarify_conversation_node(self, state: SupervisorState):
        """
        Ask the user to clarify their request.

        It is used when the user message is ambiguous, incomplete,
        or the supervisor cannot confidently determine which expert
        agent should handle the request.
        """
        msg = AIMessage(content="I didn't understand your request. Could you please clarify what you want to do?")
        
        return {BaseStateKeys.MESSAGES: [msg],
                BaseStateKeys.CURRENT_RESPONSE_MSG: msg}
    
    @safe_node("end_conversation")
    def _end_conversation_node(self, state: SupervisorState):
        """
        End the conversation with the user.

        It is used when the user explicitly indicates that they want
        to finish the conversation, such as saying goodbye or confirming
        that they no longer need assistance.
        """
        msg = AIMessage(content="Thank you! If you need more help, feel free to come back anytime.")
        
        return {BaseStateKeys.MESSAGES: [msg],
                BaseStateKeys.FINISHED: True,
                BaseStateKeys.CURRENT_RESPONSE_MSG: msg}

    def _build_graph(self) -> CompiledStateGraph:
        workflow = StateGraph(SupervisorState)
        workflow.add_node("route_from_start", self._route_from_start_node)
        workflow.add_node("ask_for_feedback", self._ask_for_feedback_node)
        workflow.add_node("decide_specialist", self._decide_specialist_node)
        workflow.add_node("call_outfit_expert", self._call_outfit_expert_node)
        workflow.add_node("call_buy_expert", self._call_buy_expert_node)
        workflow.add_node("call_order_expert", self._call_order_expert_node)
        workflow.add_node("clarify_conversation", self._clarify_conversation_node)
        workflow.add_node("end_conversation", self._end_conversation_node)

        workflow.add_edge(START, "route_from_start")
        workflow.add_conditional_edges(
            "call_outfit_expert",
            lambda state: state.get(SupervisorStateKeys.EVALUATING_UNCOMPREHENDED_MSG, False),
            {
                True: "decide_specialist",
                False: "ask_for_feedback"
            }
        )
        workflow.add_conditional_edges(
            "call_buy_expert",
            lambda state: state.get(SupervisorStateKeys.EVALUATING_UNCOMPREHENDED_MSG, False),
            {
                True: "decide_specialist",
                False: "ask_for_feedback"
            }
        )
        workflow.add_conditional_edges(
            "call_order_expert",
            lambda state: state.get(SupervisorStateKeys.EVALUATING_UNCOMPREHENDED_MSG, False),
            {
                True: "decide_specialist",
                False: "ask_for_feedback"
            }
        )
        workflow.add_edge("clarify_conversation", "ask_for_feedback")
        workflow.add_edge("ask_for_feedback", "route_from_start")
        workflow.add_edge("end_conversation", END)

        checkpointer = MemorySaver()

        return workflow.compile(
            checkpointer=checkpointer,
            interrupt_after=["ask_for_feedback"]
        )

    def _get_graph_key(self) -> str:
        return "supervisor"
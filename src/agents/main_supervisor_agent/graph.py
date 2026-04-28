from agents.base_graph import BaseGraph
from langgraph.graph import StateGraph, START
from langgraph.graph.state import CompiledStateGraph
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command
from core.settings import settings
from schemas.outfit_maker.product_solicitation import ItemSpecList
from schemas.orchestator_decision import OrchestatorDecision
from infra.db.product_search import search_product_candidates
from state import State, StateKeys, SumaryKeys
from utils.models import get_llm_model
from utils.error_handling import safe_node
from utils.prompts import build_prompt
from utils.catalog_taxonomy import taxonomy_prompt_reference
from langchain_core.messages import SystemMessage
from langchain_core.messages import AIMessage
from typing import Any
import json

class SupervisorGraph(BaseGraph):

    @safe_node("orchestator_planner")
    def _orchestator_node(self, state: State) -> Command:
        sys_prompt = build_prompt(
            base_prompt_path="src/prompts/orchestator_planner/system_prompt.txt",
            examples_prompt_path="src/prompts/orchestator_planner/examples_system_prompt.txt",
            include_examples=settings.INCLUDE_PROMPT_EXAMPLES
        )
        supervisor_llm = get_llm_model(is_supervisor=True).with_structured_output(OrchestatorDecision)
        messages = [SystemMessage(content=sys_prompt)] + state[StateKeys.MESSAGES]
        response: OrchestatorDecision = supervisor_llm.invoke(messages)

        if response.plan:
            return Command(goto="plan_router", 
                            update={StateKeys.PLAN: response.plan,
                                    StateKeys.CURRENT_STEP_INDEX: 0
                            })

        if response.custom_answer is not None:
            return Command(goto="ask_for_feedback",
                            update={StateKeys.MESSAGES: [AIMessage(content=response.custom_answer)],
                                    StateKeys.PREVIOUS_SUMMARY: {
                                        SumaryKeys.CONTENT: state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.CONTENT],
                                        SumaryKeys.POS_MSGS_COUNT: state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.POS_MSGS_COUNT] + 1
                            }})
        
        if response.use_default_clarification:
            return Command(goto="ask_for_feedback",
                           update={StateKeys.UNCLEAR_MSG: True,
                                   StateKeys.MESSAGES: [AIMessage(content="Sorry, but I didn't understand your last message. Could you clarify your answer a little?")],
                                   StateKeys.PREVIOUS_SUMMARY: {
                                        SumaryKeys.CONTENT: state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.CONTENT],
                                        SumaryKeys.POS_MSGS_COUNT: state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.POS_MSGS_COUNT] + 1
                            }})
        
        raise ValueError("Invalid response from orchestator planner agent")
    
    @safe_node("plan_router")
    def _plan_router_node(self, state: State) -> Command:
        print("\nRouting according to the orchestator plan ---")
        plan = state.get(StateKeys.PLAN, [])
        current_step_index = state.get(StateKeys.CURRENT_STEP_INDEX, 0)

        if current_step_index >= len(plan):
            return Command(goto="ask_for_feedback")

        next_node = plan[current_step_index]
        print(f"Next node in the plan: {next_node}")
        return Command(goto=getattr(next_node, "value", next_node), update={
            StateKeys.CURRENT_STEP_INDEX: current_step_index + 1
        })

    @safe_node("extract_outfit_request")
    def _extract_outfit_request_node(self, state: State) -> dict[StateKeys, Any]:
        print("\nExtracting outfit request from user messages ---")
        base_prompt_path = "src/prompts/outfit_request_extractor/system_prompt.txt"
        examples_prompt_path = "src/prompts/outfit_request_extractor/examples_system_prompt.txt"
        sys_prompt = build_prompt(
            base_prompt_path=base_prompt_path,
            examples_prompt_path=examples_prompt_path,
            include_examples=settings.INCLUDE_PROMPT_EXAMPLES
        )
        llm = get_llm_model(is_supervisor=False).with_structured_output(ItemSpecList)
        current_request = state.get(StateKeys.CURRENT_OUTFIT_REQUEST)
        context = {
            "search_intents": state.get(StateKeys.OUTFIT_SEARCH_INTENTS, []),
            "current_solicitation": current_request.model_dump() if current_request else None,
            "summary": state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.CONTENT],
        }
        recent_messages = state[StateKeys.MESSAGES][-5:] if len(state[StateKeys.MESSAGES]) >= 5 else state[StateKeys.MESSAGES]
        messages = [
            SystemMessage(content=sys_prompt),
            SystemMessage(
                content=(
                    "Catalog taxonomy reference for garment categorization. "
                    "Use only these exact master_categories, sub_categories, and article_types values "
                    f"when they can be identified:\n{taxonomy_prompt_reference()}"
                )
            ),
            SystemMessage(content=f"Context for extraction: {json.dumps(context, indent=2)}"),
            *recent_messages
        ]
        solicitations: ItemSpecList = llm.invoke(messages)
        print("Search intents extracted: ", state.get(StateKeys.OUTFIT_SEARCH_INTENTS, []))
        print(f"Extracted outfit request: {solicitations}")
        return {StateKeys.CURRENT_OUTFIT_REQUEST: solicitations}
        
    @safe_node("search_products")
    def _search_products_node(self, state: State) -> dict[StateKeys, Any]:
        print("\nSearching products in the database according to the outfit request ---")

        product_candidates = search_product_candidates(
            state.get(StateKeys.CURRENT_OUTFIT_REQUEST)
        )
        print(f"Found product candidates: {product_candidates}")
        return {StateKeys.PRODUCT_CANDIDATES: product_candidates}
    
    @safe_node("business_qa")
    def _business_qa_node(self, state: State): # temporal, falta implementar!
        print("\nAnswering business questions ---")

        return {}

    @safe_node("build_outfit")
    def _build_outfit_node(self, state: State) -> dict[StateKeys, Any]:
        print("\nBuilding outfit from product candidates ---")

        return {StateKeys.CURRENT_OUTFIT: {
            "items": state.get(StateKeys.PRODUCT_CANDIDATES, [])
        }}

    @safe_node("final_response")
    def _final_response_node(self, state: State) -> dict[StateKeys, Any]:
        print("\nProducing final response ---")

        product_candidates = state.get(StateKeys.PRODUCT_CANDIDATES, []) or []
        found_count = sum(self._count_candidates(item) for item in product_candidates)
        message = (
            f"I found {found_count} product options for your request."
            if found_count
            else "I couldn't find product options that match your request."
        )

        return {StateKeys.MESSAGES: [AIMessage(content=message)]}

    def _count_candidates(self, item: dict[str, Any]) -> int:
        if "candidates" in item:
            return len(item["candidates"])
        return sum(len(garment.get("candidates", [])) for garment in item.get("items", []))
    
    @safe_node("ask_for_feedback")
    def _ask_for_feedback_node(self, state: State):
        print("\nAsking for user feedback on the system response ---")

        return {}


    def _build_graph(self) -> CompiledStateGraph:
        workflow = StateGraph(State)
        workflow.add_node("plan_router", self._plan_router_node)
        workflow.add_node("orchestator_planner", self._orchestator_node)
        workflow.add_node("extract_outfit_request", self._extract_outfit_request_node)
        workflow.add_node("search_products", self._search_products_node)
        workflow.add_node("business_qa", self._business_qa_node)
        workflow.add_node("build_outfit", self._build_outfit_node)
        workflow.add_node("final_response", self._final_response_node)
        workflow.add_node("ask_for_feedback", self._ask_for_feedback_node)

        workflow.add_edge(START, "orchestator_planner")
        workflow.add_edge("extract_outfit_request", "plan_router")
        workflow.add_edge("search_products", "plan_router")
        workflow.add_edge("business_qa", "plan_router")
        workflow.add_edge("build_outfit", "plan_router")
        workflow.add_edge("final_response", "plan_router")
        workflow.add_edge("ask_for_feedback", "orchestator_planner")

        checkpointer = MemorySaver()

        return workflow.compile(
            checkpointer=checkpointer,
            interrupt_after=["ask_for_feedback"]
        )

    def _get_graph_key(self) -> str:
        return "supervisor"

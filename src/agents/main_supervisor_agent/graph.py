import json
import logging
from typing import Any

from agents.base_graph import BaseGraph
from core.settings import settings
from infra.db.product_search import search_product_candidates
from langchain_core.messages import AIMessage, SystemMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from langgraph.types import Command
from schemas.orchestator_decision import NodeName, OrchestatorDecision
from schemas.outfit_maker.product_solicitation import ItemSpecList, SearchPriorityField
from services.business_qa.rag_service import get_business_qa_service
from services.final_response_service import FinalResponseService
from services.outfit_recommendation_service import OutfitRecommendationService
from services.outfit_request_service import OutfitRequestService
from state import State, StateKeys, SumaryKeys
from utils.catalog_taxonomy import taxonomy_prompt_reference
from utils.error_handling import safe_node
from utils.models import get_llm_model
from utils.prompts import build_prompt


logger = logging.getLogger(__name__)


class SupervisorGraph(BaseGraph):
    def __init__(self, checkpointer=None) -> None:
        self._checkpointer = checkpointer
        self._business_qa_service = get_business_qa_service()
        self._outfit_recommendation_service = OutfitRecommendationService()
        self._outfit_request_service = OutfitRequestService()
        self._final_response_service = FinalResponseService()

    @safe_node("orchestator_planner")
    def _orchestator_node(self, state: State) -> Command:
        latest_message = state[StateKeys.MESSAGES][-1]
        clarification = self._outfit_request_service.generic_request_clarification(
            str(latest_message.content),
            state.get(StateKeys.STYLE_PREFERENCE_CONTEXT, {}),
        )
        if clarification:
            return Command(
                goto="ask_for_feedback",
                update={
                    StateKeys.MESSAGES: [AIMessage(content=clarification)],
                    StateKeys.UNCLEAR_MSG: False,
                    StateKeys.PREVIOUS_SUMMARY: {
                        SumaryKeys.CONTENT: state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.CONTENT],
                        SumaryKeys.POS_MSGS_COUNT: state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.POS_MSGS_COUNT] + 1,
                    },
                },
            )

        sys_prompt = build_prompt(
            base_prompt_path="src/prompts/orchestator_planner/system_prompt.txt",
            examples_prompt_path="src/prompts/orchestator_planner/examples_system_prompt.txt",
            include_examples=settings.INCLUDE_PROMPT_EXAMPLES,
        )
        supervisor_llm = get_llm_model(is_supervisor=True).with_structured_output(OrchestatorDecision)
        planner_context = {
            "summary": state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.CONTENT],
            "style_preferences": state.get(StateKeys.STYLE_PREFERENCE_CONTEXT, {}),
        }
        messages = [
            SystemMessage(content=sys_prompt),
            SystemMessage(content=f"Context for planning: {json.dumps(planner_context, indent=2)}"),
            *state[StateKeys.MESSAGES],
        ]
        response: OrchestatorDecision = supervisor_llm.invoke(messages)

        if response.plan:
            uses_outfit_flow = any(
                node in response.plan
                for node in (
                    NodeName.EXTRACT_OUTFIT_REQUEST,
                    NodeName.SEARCH_PRODUCTS,
                    NodeName.BUILD_OUTFIT,
                )
            )
            return Command(
                goto="plan_router",
                update={
                    StateKeys.PLAN: response.plan,
                    StateKeys.CURRENT_STEP_INDEX: 0,
                    StateKeys.BUSINESS_QA_QUERIES: response.business_qa_queries,
                    StateKeys.OUTFIT_SEARCH_INTENTS: response.outfit_search_intents,
                    StateKeys.BUSINESS_ANSWERS: None,
                    StateKeys.PRODUCT_CANDIDATES: None if uses_outfit_flow else None,
                    StateKeys.CURRENT_OUTFIT: None if uses_outfit_flow else None,
                    StateKeys.OUTFIT_REQUEST_NEEDS_CLARIFICATION: False,
                    StateKeys.FINAL_ANSWER: None,
                    StateKeys.FINAL_RESPONSE_PAYLOAD: None,
                },
            )

        if response.custom_answer is not None:
            return Command(
                goto="ask_for_feedback",
                update={
                    StateKeys.MESSAGES: [AIMessage(content=response.custom_answer)],
                    StateKeys.PREVIOUS_SUMMARY: {
                        SumaryKeys.CONTENT: state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.CONTENT],
                        SumaryKeys.POS_MSGS_COUNT: state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.POS_MSGS_COUNT] + 1,
                    },
                },
            )

        if response.use_default_clarification:
            return Command(
                goto="ask_for_feedback",
                update={
                    StateKeys.UNCLEAR_MSG: True,
                    StateKeys.MESSAGES: [
                        AIMessage(
                            content="Sorry, but I didn't understand your last message. Could you clarify your answer a little?"
                        )
                    ],
                    StateKeys.PREVIOUS_SUMMARY: {
                        SumaryKeys.CONTENT: state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.CONTENT],
                        SumaryKeys.POS_MSGS_COUNT: state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.POS_MSGS_COUNT] + 1,
                    },
                },
            )

        raise ValueError("Invalid response from orchestator planner agent")

    @safe_node("plan_router")
    def _plan_router_node(self, state: State) -> Command:
        logger.info("Routing according to the orchestator plan")
        plan = state.get(StateKeys.PLAN, [])
        current_step_index = state.get(StateKeys.CURRENT_STEP_INDEX, 0)

        if current_step_index >= len(plan):
            return Command(goto="ask_for_feedback")

        next_node = plan[current_step_index]
        logger.info("Next node in the plan: %s", next_node)
        return Command(
            goto=getattr(next_node, "value", next_node),
            update={StateKeys.CURRENT_STEP_INDEX: current_step_index + 1},
        )

    @safe_node("extract_outfit_request")
    def _extract_outfit_request_node(self, state: State) -> dict[StateKeys, Any]:
        logger.info("Extracting outfit request from user messages")
        sys_prompt = build_prompt(
            base_prompt_path="src/prompts/outfit_request_extractor/system_prompt.txt",
            examples_prompt_path="src/prompts/outfit_request_extractor/examples_system_prompt.txt",
            include_examples=settings.INCLUDE_PROMPT_EXAMPLES,
        )
        llm = get_llm_model(is_supervisor=False).with_structured_output(ItemSpecList)
        current_request = state.get(StateKeys.CURRENT_OUTFIT_REQUEST)
        context = {
            "search_intents": state.get(StateKeys.OUTFIT_SEARCH_INTENTS, []),
            "priority_fields": state.get(StateKeys.SEARCH_PRIORITY_FIELDS, []),
            "style_preferences": state.get(StateKeys.STYLE_PREFERENCE_CONTEXT, {}),
            "current_solicitation": current_request.model_dump() if current_request else None,
            "summary": state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.CONTENT],
        }
        recent_messages = (
            state[StateKeys.MESSAGES][-5:]
            if len(state[StateKeys.MESSAGES]) >= 5
            else state[StateKeys.MESSAGES]
        )
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
            *recent_messages,
        ]
        solicitations: ItemSpecList = llm.invoke(messages)
        solicitations, needs_clarification = self._outfit_request_service.prepare_request(
            solicitations,
            state.get(StateKeys.STYLE_PREFERENCE_CONTEXT, {}),
        )
        solicitations = self._apply_configured_priority_fields(
            solicitations,
            state.get(StateKeys.SEARCH_PRIORITY_FIELDS, []),
        )
        logger.debug("Search intents extracted: %s", state.get(StateKeys.OUTFIT_SEARCH_INTENTS, []))
        logger.info("Extracted outfit request with %s item(s)", len(solicitations.items))
        logger.debug("Extracted outfit request details: %s", solicitations)
        if needs_clarification:
            logger.info("Outfit request needs clarification before product search")
            return {
                StateKeys.CURRENT_OUTFIT_REQUEST: solicitations,
                StateKeys.OUTFIT_REQUEST_NEEDS_CLARIFICATION: True,
                StateKeys.PRODUCT_CANDIDATES: [],
                StateKeys.CURRENT_OUTFIT: None,
                StateKeys.PLAN: [NodeName.FINAL_RESPONSE],
                StateKeys.CURRENT_STEP_INDEX: 0,
            }

        return {
            StateKeys.CURRENT_OUTFIT_REQUEST: solicitations,
            StateKeys.OUTFIT_REQUEST_NEEDS_CLARIFICATION: False,
        }

    @safe_node("search_products")
    def _search_products_node(self, state: State) -> dict[StateKeys, Any]:
        logger.info("Searching products in the database according to the outfit request")
        product_candidates = search_product_candidates(
            state.get(StateKeys.CURRENT_OUTFIT_REQUEST),
            priority_fields=state.get(StateKeys.SEARCH_PRIORITY_FIELDS, []),
            style_preference_context=state.get(StateKeys.STYLE_PREFERENCE_CONTEXT, {}),
            image_search_features=state.get(StateKeys.IMAGE_SEARCH_FEATURES, []),
        )
        logger.info("Found product candidates for %s request item(s)", len(product_candidates))
        logger.debug("Product candidate details: %s", product_candidates)
        return {StateKeys.PRODUCT_CANDIDATES: product_candidates}

    def _apply_configured_priority_fields(
        self,
        solicitations: ItemSpecList,
        priority_fields: list[SearchPriorityField],
    ) -> ItemSpecList:
        configured_fields = list(priority_fields or [])
        items_data: list[dict[str, Any]] = []

        for item in solicitations.items:
            item_data = item.model_dump()
            item_data["priority_fields"] = configured_fields
            if item_data.get("kind") == "outfit":
                item_data["items"] = [
                    {
                        **garment,
                        "priority_fields": configured_fields,
                    }
                    for garment in item_data.get("items", [])
                ]
            items_data.append(item_data)

        return ItemSpecList(items=items_data)

    @safe_node("business_qa")
    def _business_qa_node(self, state: State) -> dict[StateKeys, Any]:
        logger.info("Answering business questions")
        answers = self._business_qa_service.answer_queries(
            queries=state.get(StateKeys.BUSINESS_QA_QUERIES),
            conversation_summary=state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.CONTENT],
        )
        return {StateKeys.BUSINESS_ANSWERS: answers}

    @safe_node("build_outfit")
    def _build_outfit_node(self, state: State) -> dict[StateKeys, Any]:
        logger.info("Building outfit from product candidates")
        recommendations = self._outfit_recommendation_service.build_recommendation_bundle(
            state.get(StateKeys.PRODUCT_CANDIDATES, []) or []
        )
        return {StateKeys.CURRENT_OUTFIT: recommendations}

    @safe_node("final_response")
    def _final_response_node(self, state: State) -> dict[StateKeys, Any]:
        logger.info("Producing final response")

        recommendations = state.get(StateKeys.CURRENT_OUTFIT)
        if recommendations is None:
            recommendations = self._outfit_recommendation_service.build_recommendation_bundle(
                state.get(StateKeys.PRODUCT_CANDIDATES, []) or []
            )

        business_answers = state.get(StateKeys.BUSINESS_ANSWERS) or []
        logger.debug("Recommendations to be included in the final response: %s", recommendations)
        response_payload = self._final_response_service.build_final_response_payload(
            state=state,
            recommendations=recommendations,
            business_answers=business_answers,
        )

        logger.info("Final response produced with %s section(s)", len(response_payload.sections))
        logger.debug("Final response payload: %s", response_payload)

        return {
            StateKeys.FINAL_ANSWER: response_payload.message,
            StateKeys.FINAL_RESPONSE_PAYLOAD: response_payload,
            StateKeys.PREVIOUS_SUMMARY: {
                SumaryKeys.CONTENT: state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.CONTENT],
                SumaryKeys.POS_MSGS_COUNT: state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.POS_MSGS_COUNT] + 1,
            },
            StateKeys.MESSAGES: [
                AIMessage(
                    content=response_payload.message,
                    additional_kwargs={
                        "final_response_payload": response_payload.model_dump(mode="json"),
                    },
                )
            ],
        }

    @safe_node("ask_for_feedback")
    def _ask_for_feedback_node(self, state: State) -> dict[StateKeys, Any]:
        logger.info("Asking for user feedback on the system response")
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

        checkpointer = self._checkpointer or MemorySaver()

        return workflow.compile(
            checkpointer=checkpointer,
            interrupt_after=["ask_for_feedback"],
        )

    def _get_graph_key(self) -> str:
        if self._checkpointer is None:
            return "supervisor:memory"
        return (
            "supervisor:"
            f"{type(self._checkpointer).__module__}."
            f"{type(self._checkpointer).__name__}:"
            f"{id(self._checkpointer)}"
        )

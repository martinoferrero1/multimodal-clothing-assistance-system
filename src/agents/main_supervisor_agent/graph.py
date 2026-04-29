from agents.base_graph import BaseGraph
from langgraph.graph import StateGraph, START
from langgraph.graph.state import CompiledStateGraph
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command
from core.settings import settings
from schemas.outfit_maker.product_solicitation import GarmentSpec, ItemSpecList, OutfitSpec
from schemas.outfit_maker.recommendation_response import (
    FinalResponsePayload,
    FinalResponseSection,
    GarmentRecommendation,
    OutfitRecommendation,
    ProductRecommendation,
    RecommendationBundle,
)
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

        recommendations = self._build_recommendation_bundle(
            state.get(StateKeys.PRODUCT_CANDIDATES, []) or []
        )
        return {StateKeys.CURRENT_OUTFIT: recommendations}

    @safe_node("final_response")
    def _final_response_node(self, state: State) -> dict[StateKeys, Any]:
        print("\nProducing final response ---")

        recommendations = state.get(StateKeys.CURRENT_OUTFIT) or self._build_recommendation_bundle(
            state.get(StateKeys.PRODUCT_CANDIDATES, []) or []
        )
        business_answer_texts = self._extract_business_answer_texts(
            state.get(StateKeys.BUSINESS_ANSWERS, []) or []
        )
        response_payload = self._build_final_response_payload(
            recommendations=recommendations,
            business_answer_texts=business_answer_texts,
        )

        return {
            StateKeys.FINAL_ANSWER: response_payload.message,
            StateKeys.FINAL_RESPONSE_PAYLOAD: response_payload,
            StateKeys.MESSAGES: [
                AIMessage(
                    content=response_payload.message,
                    additional_kwargs={
                        "final_response_payload": response_payload.model_dump(mode="json")
                    },
                )
            ],
        }

    def _build_recommendation_bundle(
        self,
        product_candidates: list[dict[str, Any]],
    ) -> RecommendationBundle:
        garments: list[GarmentRecommendation] = []
        outfits: list[OutfitRecommendation] = []

        for item in product_candidates:
            if item.get("kind") == "outfit":
                outfits.append(self._build_outfit_recommendation(item))
                continue
            garments.append(self._build_garment_recommendation(item))

        return RecommendationBundle(garments=garments, outfits=outfits)

    def _build_outfit_recommendation(self, outfit_candidate: dict[str, Any]) -> OutfitRecommendation:
        selected_items = [
            self._build_garment_recommendation(garment_candidate)
            for garment_candidate in outfit_candidate.get("items", [])
        ]
        outfit_request_data = dict(outfit_candidate.get("request") or {})
        outfit_request_data["kind"] = "outfit"
        outfit_request_data["items"] = [
            garment_candidate.get("request", {})
            for garment_candidate in outfit_candidate.get("items", [])
        ]
        request = OutfitSpec(**outfit_request_data)
        return OutfitRecommendation(
            request=request,
            items=selected_items,
            summary_label=self._build_outfit_label(request),
        )

    def _build_garment_recommendation(
        self,
        garment_candidate: dict[str, Any],
    ) -> GarmentRecommendation:
        request = GarmentSpec(**garment_candidate.get("request", {}))
        candidates = garment_candidate.get("candidates", []) or []
        best_match = self._build_product_recommendation(candidates[0]) if candidates else None

        return GarmentRecommendation(
            request=request,
            best_match=best_match,
            total_candidates=len(candidates),
            summary_label=self._build_garment_label(request, best_match),
        )

    def _build_product_recommendation(
        self,
        product_data: dict[str, Any],
    ) -> ProductRecommendation:
        return ProductRecommendation(**product_data)

    def _extract_business_answer_texts(self, business_answers: list[dict[str, Any]]) -> list[str]:
        texts: list[str] = []
        for answer in business_answers:
            if not isinstance(answer, dict):
                texts.append(str(answer))
                continue

            for key in ("answer", "content", "response", "text", "message"):
                value = answer.get(key)
                if isinstance(value, str) and value.strip():
                    texts.append(value.strip())
                    break

        return texts

    def _build_final_response_payload(
        self,
        recommendations: RecommendationBundle,
        business_answer_texts: list[str],
    ) -> FinalResponsePayload:
        sections: list[FinalResponseSection] = []

        if business_answer_texts:
            sections.append(
                FinalResponseSection(
                    type="text",
                    content=" ".join(business_answer_texts),
                )
            )

        if recommendations.outfits or recommendations.garments:
            sections.append(
                FinalResponseSection(
                    type="text",
                    content=self._build_recommendation_intro(recommendations),
                )
            )

            if recommendations.outfits:
                sections.append(
                    FinalResponseSection(
                        type="outfit_recommendations",
                        title="Recommended outfits",
                    )
                )

            if recommendations.garments:
                sections.append(
                    FinalResponseSection(
                        type="garment_recommendations",
                        title="Recommended garments",
                    )
                )

            sections.append(
                FinalResponseSection(
                    type="text",
                    content="If you want, I can refine these picks by color, budget, season, or occasion.",
                )
            )
        elif not business_answer_texts:
            sections.append(
                FinalResponseSection(
                    type="text",
                    content="I couldn't find matching garments for your request yet.",
                )
            )

        message = self._render_response_text(sections, recommendations)
        return FinalResponsePayload(
            message=message,
            sections=sections,
            recommendations=recommendations,
            business_answer_texts=business_answer_texts,
        )

    def _build_recommendation_intro(self, recommendations: RecommendationBundle) -> str:
        parts: list[str] = []
        if recommendations.outfits:
            parts.append(
                "For each requested outfit, I combined the top match for every garment into a first draft recommendation."
            )
        if recommendations.garments:
            parts.append(
                "For standalone garments, I selected the single best match available right now."
            )
        return " ".join(parts)

    def _render_response_text(
        self,
        sections: list[FinalResponseSection],
        recommendations: RecommendationBundle,
    ) -> str:
        rendered_sections: list[str] = []

        for section in sections:
            if section.type == "text" and section.content:
                rendered_sections.append(section.content.strip())
                continue

            if section.type == "outfit_recommendations" and recommendations.outfits:
                rendered_sections.append(self._render_outfit_recommendations(recommendations.outfits))
                continue

            if section.type == "garment_recommendations" and recommendations.garments:
                rendered_sections.append(self._render_garment_recommendations(recommendations.garments))

        return "\n\n".join(section for section in rendered_sections if section).strip()

    def _render_outfit_recommendations(
        self,
        outfits: list[OutfitRecommendation],
    ) -> str:
        lines = ["Recommended outfits:"]

        for index, outfit in enumerate(outfits, start=1):
            lines.append(f"{index}. {outfit.summary_label}")
            for garment in outfit.items:
                lines.append(f"- {garment.summary_label}: {self._render_product_match(garment.best_match)}")

        return "\n".join(lines)

    def _render_garment_recommendations(
        self,
        garments: list[GarmentRecommendation],
    ) -> str:
        lines = ["Recommended garments:"]

        for index, garment in enumerate(garments, start=1):
            lines.append(f"{index}. {garment.summary_label}: {self._render_product_match(garment.best_match)}")

        return "\n".join(lines)

    def _render_product_match(self, match: ProductRecommendation | None) -> str:
        if match is None:
            return "No match found."

        descriptors = [match.product_display_name]
        extra_parts: list[str] = []

        if match.brand:
            extra_parts.append(match.brand)
        if match.base_colour:
            extra_parts.append(match.base_colour)
        if match.price is not None:
            extra_parts.append(f"${match.price:.2f}")

        if extra_parts:
            descriptors.append(f"({', '.join(extra_parts)})")

        return " ".join(descriptors)

    def _build_garment_label(
        self,
        request: GarmentSpec,
        best_match: ProductRecommendation | None,
    ) -> str:
        article_type = self._first_value(request.article_types)
        product_name = self._first_value(request.product_names)
        base_color = self._first_value(request.base_colors)

        if product_name:
            label = product_name
        elif article_type:
            label = article_type
        elif best_match and best_match.article_type:
            label = best_match.article_type
        else:
            label = "Garment"

        if base_color:
            return f"{base_color} {label}".strip()
        return label.strip()

    def _build_outfit_label(self, request: OutfitSpec) -> str:
        usage = request.usage
        season = self._first_value(request.seasons)

        if usage and season:
            return f"{season} {usage} outfit"
        if usage:
            return f"{usage} outfit"
        if season:
            return f"{season} outfit"
        return "Outfit recommendation"

    def _first_value(self, values: list[str] | None) -> str | None:
        if not values:
            return None
        return values[0]
    
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

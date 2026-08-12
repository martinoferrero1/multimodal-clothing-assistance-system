import json
import logging
from typing import Any

from core.metaclasses.singleton_meta import SingletonMeta
from langchain_core.messages import SystemMessage

from schemas.business_qa import BusinessAnswer
from schemas.outfit_maker.recommendation_response import (
    FinalResponseDraft,
    FinalResponseDraftSection,
    FinalResponsePayload,
    FinalResponseSection,
    OutfitRecommendation,
    ProductRecommendation,
    RecommendationBundle,
)
from state import State, StateKeys, SumaryKeys
from utils.models import get_llm_model
from utils.prompts import build_prompt


logger = logging.getLogger(__name__)


class FinalResponseService(metaclass=SingletonMeta):
    def build_final_response_payload(
        self,
        state: State,
        recommendations: RecommendationBundle,
        business_answers: list[BusinessAnswer],
    ) -> FinalResponsePayload:
        business_answer_texts = [answer.answer for answer in business_answers if answer.answer.strip()]
        request_needs_clarification = bool(
            state.get(StateKeys.OUTFIT_REQUEST_NEEDS_CLARIFICATION, False)
        )
        draft = self._generate_final_response_draft(
            state=state,
            recommendations=recommendations,
            business_answer_texts=business_answer_texts,
        )
        sections = self._normalize_final_response_sections(
            draft_sections=draft.sections,
            recommendations=recommendations,
            business_answer_texts=business_answer_texts,
            request_needs_clarification=request_needs_clarification,
        )
        message = self._render_response_text(sections, recommendations)
        return FinalResponsePayload(
            message=message,
            sections=sections,
            recommendations=recommendations,
            business_answer_texts=business_answer_texts,
        )

    def _generate_final_response_draft(
        self,
        state: State,
        recommendations: RecommendationBundle,
        business_answer_texts: list[str],
    ) -> FinalResponseDraft:
        sys_prompt = build_prompt(
            base_prompt_path="src/prompts/final_response_writer/system_prompt.txt",
            examples_prompt_path=None,
            include_examples=False,
        )
        llm = get_llm_model(is_supervisor=False).with_structured_output(FinalResponseDraft)
        recent_messages = (
            state[StateKeys.MESSAGES][-6:]
            if len(state[StateKeys.MESSAGES]) >= 6
            else state[StateKeys.MESSAGES]
        )
        context = {
            "previous_summary": state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.CONTENT],
            "business_answers": business_answer_texts,
            "available_recommendations": self._serialize_recommendations_for_writer(recommendations),
            "style_preferences": state.get(StateKeys.STYLE_PREFERENCE_CONTEXT, {}),
            "instructions": {
                "request_needs_clarification": bool(
                    state.get(StateKeys.OUTFIT_REQUEST_NEEDS_CLARIFICATION, False)
                ),
                "outfit_placeholder_required": bool(recommendations.outfits),
                "product_highlights_required": self._has_product_highlights(recommendations),
            },
        }

        result = llm.invoke([
            SystemMessage(content=sys_prompt),
            SystemMessage(content=f"Context for final response writing: {json.dumps(context, indent=2)}"),
            *recent_messages,
        ])

        logger.debug("LLM output for final response draft: %s", result)
        return result

    def _serialize_recommendations_for_writer(
        self,
        recommendations: RecommendationBundle,
    ) -> dict[str, Any]:
        return {
            "outfits": [
                {
                    "summary_label": outfit.summary_label,
                    "items": [
                        {
                            "summary_label": garment.summary_label,
                            "best_match_name": garment.best_match.product_display_name if garment.best_match else None,
                            "best_match_brand": garment.best_match.brand if garment.best_match else None,
                            "best_match_color": garment.best_match.base_colour if garment.best_match else None,
                            "best_match_price": garment.best_match.price if garment.best_match else None,
                        }
                        for garment in outfit.items
                    ],
                }
                for outfit in recommendations.outfits
            ],
            "garments": [
                {
                    "summary_label": garment.summary_label,
                    "garment_type_label": garment.garment_type_label,
                    "best_match_name": garment.best_match.product_display_name if garment.best_match else None,
                    "best_match_brand": garment.best_match.brand if garment.best_match else None,
                    "best_match_color": garment.best_match.base_colour if garment.best_match else None,
                    "best_match_price": garment.best_match.price if garment.best_match else None,
                }
                for garment in recommendations.garments
            ],
            "product_highlights": self._serialize_product_highlights(recommendations),
        }

    def _normalize_final_response_sections(
        self,
        draft_sections: list[FinalResponseDraftSection],
        recommendations: RecommendationBundle,
        business_answer_texts: list[str],
        request_needs_clarification: bool = False,
    ) -> list[FinalResponseSection]:
        text_sections = [
            (section.content or "").strip()
            for section in draft_sections
            if section.type == "text" and (section.content or "").strip()
        ]
        if request_needs_clarification:
            clarification = " ".join(text_sections).strip()
            if not clarification:
                clarification = " ".join(
                    [
                        *business_answer_texts,
                        "What occasion or style would you like the outfit for?",
                    ]
                ).strip()
            return [FinalResponseSection(type="text", content=clarification)]

        product_highlights_available = self._has_product_highlights(recommendations)
        outfits_available = bool(recommendations.outfits)
        has_recommendations = product_highlights_available or outfits_available
        sections: list[FinalResponseSection] = []

        intro = text_sections[0] if text_sections else self._default_intro_text(
            recommendations,
            business_answer_texts,
        )
        if intro:
            sections.append(FinalResponseSection(type="text", content=intro))

        if product_highlights_available:
            sections.append(
                FinalResponseSection(
                    type="product_highlights",
                    title=self._product_highlights_section_title(None, recommendations),
                )
            )

        if outfits_available:
            bridge_text = (
                text_sections[1]
                if len(text_sections) > 1
                else self._default_bridge_text(product_highlights_available)
            )
            if bridge_text:
                sections.append(FinalResponseSection(type="text", content=bridge_text))
            sections.append(
                FinalResponseSection(
                    type="outfit_recommendations",
                    title="Recommended outfits",
                )
            )

        if has_recommendations:
            final_text_index = 2 if outfits_available else 1
            final_text = (
                text_sections[final_text_index]
                if len(text_sections) > final_text_index
                else self._default_final_text()
            )
            sections.append(
                FinalResponseSection(
                    type="text",
                    content=final_text,
                )
            )

        return sections

    def _product_highlights_section_title(
        self,
        draft_title: str | None,
        recommendations: RecommendationBundle,
    ) -> str:
        
        if len(recommendations.product_highlights) == 1:
            return (
                draft_title
                or recommendations.product_highlights[0].group_label
                or "Featured products"
            )

        return "Featured products"

    def _default_intro_text(
        self,
        recommendations: RecommendationBundle,
        business_answer_texts: list[str],
    ) -> str:
        intro_parts: list[str] = []

        if business_answer_texts:
            intro_parts.append(" ".join(business_answer_texts))

        if recommendations.outfits:
            intro_parts.append(
                "I found strong matches for the key pieces in your request and grouped the full outfit ideas below."
            )
        elif self._has_product_highlights(recommendations):
            intro_parts.append(
                "I selected the strongest product matches I could find for your request."
            )

        if intro_parts:
            return " ".join(intro_parts).strip()

        return "I couldn't find a strong match for your request yet."

    def _default_bridge_text(self, has_product_highlights: bool) -> str:
        if has_product_highlights:
            return "Based on those matches, here is a concise outfit view to compare the full look."

        return "Here is a concise outfit view to compare the full look."

    def _default_final_text(self) -> str:
        return "I can refine these picks further by color, budget, season, or occasion."

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
                rendered_sections.append(
                    self._render_outfit_recommendations(
                        recommendations.outfits,
                        title=section.title,
                    )
                )
                continue

            if section.type in {"garment_recommendations", "product_highlights"}:
                rendered_sections.append(
                    self._render_product_highlights(
                        recommendations,
                        title=section.title,
                    )
                )

        return "\n\n".join(section for section in rendered_sections if section).strip()

    def _render_outfit_recommendations(
        self,
        outfits: list[OutfitRecommendation],
        title: str | None = None,
    ) -> str:
        lines = [title or "Recommended outfits:"]

        for index, outfit in enumerate(outfits, start=1):
            lines.append(f"{index}. {outfit.summary_label}")
            for garment in outfit.items:
                lines.append(f"- {garment.summary_label}: {self._render_product_match(garment.best_match)}")

        return "\n".join(lines)

    def _render_product_highlights(
        self,
        recommendations: RecommendationBundle,
        title: str | None = None,
    ) -> str:
        lines = [title or "Featured products:"]

        for group in recommendations.product_highlights:
            lines.append(f"{group.group_label}:")
            for product in group.products:
                lines.append(f"- {self._render_product_match(product)}")

        return "\n".join(lines)

    def _serialize_product_highlights(
        self,
        recommendations: RecommendationBundle,
    ) -> list[dict[str, Any]]:
        return [
            {
                "group_label": group.group_label,
                "products": [
                    {
                        "product_display_name": product.product_display_name,
                        "brand": product.brand,
                        "base_colour": product.base_colour,
                        "price": product.price,
                        "score": product.score,
                    }
                    for product in group.products
                ],
            }
            for group in recommendations.product_highlights
        ]

    def _has_product_highlights(
        self,
        recommendations: RecommendationBundle,
    ) -> bool:
        return bool(recommendations.product_highlights)

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

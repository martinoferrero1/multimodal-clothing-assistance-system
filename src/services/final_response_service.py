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
        draft = self._generate_final_response_draft(
            state=state,
            recommendations=recommendations,
            business_answer_texts=business_answer_texts,
        )
        sections = self._normalize_final_response_sections(
            draft_sections=draft.sections,
            recommendations=recommendations,
            business_answer_texts=business_answer_texts,
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
            "instructions": {
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
    ) -> list[FinalResponseSection]:
        sections: list[FinalResponseSection] = []
        has_outfit_placeholder = False
        has_product_highlights_placeholder = False
        product_highlights_available = self._has_product_highlights(recommendations)

        for draft_section in draft_sections:
            if draft_section.type == "text":
                content = (draft_section.content or "").strip()
                if content:
                    sections.append(FinalResponseSection(type="text", content=content))
                continue

            if draft_section.type == "outfit_recommendations":
                if recommendations.outfits:
                    has_outfit_placeholder = True
                    sections.append(
                        FinalResponseSection(
                            type="outfit_recommendations",
                            title=draft_section.title or "Recommended outfits",
                        )
                    )
                continue

            if draft_section.type in {"garment_recommendations", "product_highlights"}:
                if product_highlights_available:
                    has_product_highlights_placeholder = True
                    sections.append(
                        FinalResponseSection(
                            type="product_highlights",
                            title=draft_section.title or "Featured products",
                        )
                    )

        if not sections:
            sections = self._default_final_response_sections(recommendations, business_answer_texts)

        if recommendations.outfits and not has_outfit_placeholder:
            sections = self._insert_placeholder(
                sections,
                FinalResponseSection(type="outfit_recommendations", title="Recommended outfits"),
            )

        if product_highlights_available and not has_product_highlights_placeholder:
            sections = self._insert_placeholder(
                sections,
                FinalResponseSection(type="product_highlights", title="Featured products"),
                before_types={"outfit_recommendations"},
            )

        if sections and sections[0].type != "text":
            intro = self._default_intro_text(recommendations, business_answer_texts)
            sections.insert(0, FinalResponseSection(type="text", content=intro))

        if not sections or sections[-1].type != "text":
            sections.append(
                FinalResponseSection(
                    type="text",
                    content="If you want, I can refine these picks further by color, budget, season, or occasion.",
                )
            )

        return sections

    def _default_final_response_sections(
        self,
        recommendations: RecommendationBundle,
        business_answer_texts: list[str],
    ) -> list[FinalResponseSection]:
        sections: list[FinalResponseSection] = []
        intro = self._default_intro_text(recommendations, business_answer_texts)
        if intro:
            sections.append(FinalResponseSection(type="text", content=intro))

        if self._has_product_highlights(recommendations):
            sections.append(
                FinalResponseSection(type="product_highlights", title="Featured products")
            )

        if recommendations.outfits:
            sections.append(
                FinalResponseSection(type="outfit_recommendations", title="Recommended outfits")
            )

        if self._has_product_highlights(recommendations) or recommendations.outfits:
            sections.append(
                FinalResponseSection(
                    type="text",
                    content="If you want, I can refine these picks further by color, budget, season, or occasion.",
                )
            )

        if not sections:
            sections.append(
                FinalResponseSection(
                    type="text",
                    content="I couldn't find a strong match for your request yet.",
                )
            )

        return sections

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

    def _insert_placeholder(
        self,
        sections: list[FinalResponseSection],
        placeholder: FinalResponseSection,
        before_types: set[str] | None = None,
    ) -> list[FinalResponseSection]:
        if not sections:
            return [placeholder]
        if before_types:
            for index, section in enumerate(sections):
                if section.type in before_types:
                    return sections[:index] + [placeholder] + sections[index:]
        if len(sections) >= 1 and sections[-1].type == "text":
            return sections[:-1] + [placeholder, sections[-1]]
        return [*sections, placeholder]

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

from __future__ import annotations

import logging
from typing import Any

from core.metaclasses.singleton_meta import SingletonMeta
from langchain_core.messages import HumanMessage, SystemMessage
from utils.models import get_image_analysis_model


logger = logging.getLogger(__name__)


IMAGE_ANALYSIS_PROMPT = """
You describe clothing product images for a fashion e-commerce search engine.

Return one concise paragraph in English with only visually supported attributes:
- garment or outfit type
- dominant and secondary colors
- apparent gender presentation if visible
- style, usage, season, pattern, material, fit, and notable details
- visible brand or logo text only when readable

If there are multiple garments, mention each one separately. Do not invent exact
brands, prices, years, or unavailable details.
""".strip()


class ImageAnalysisService(metaclass=SingletonMeta):
    def describe_attachments(self, attachments: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not attachments:
            return []

        return [
            {
                **attachment,
                "description": self._describe_attachment(attachment),
            }
            for attachment in attachments
        ]

    def _describe_attachment(self, attachment: dict[str, Any]) -> str:
        data_url = str(attachment.get("data_url") or "")
        filename = str(attachment.get("filename") or "uploaded image")
        if not data_url:
            return "An uploaded fashion image was provided, but no image data was available."

        try:
            llm = get_image_analysis_model()
            response = llm.invoke(
                [
                    SystemMessage(content=IMAGE_ANALYSIS_PROMPT),
                    HumanMessage(
                        content=[
                            {
                                "type": "text",
                                "text": (
                                    "Describe this image for product search. "
                                    f"Filename: {filename}"
                                ),
                            },
                            {
                                "type": "image_url",
                                "image_url": data_url,
                            },
                        ]
                    ),
                ]
            )
        except Exception:
            logger.exception("Image analysis failed for attachment %s", filename)
            return "An uploaded fashion image was provided, but it could not be analyzed automatically."

        content = getattr(response, "content", "")
        if isinstance(content, list):
            content = " ".join(
                str(item.get("text", item)) if isinstance(item, dict) else str(item)
                for item in content
            )
        return str(content).strip() or "An uploaded fashion image was provided."

from __future__ import annotations

import json
import logging
from typing import Any

from core.metaclasses.singleton_meta import SingletonMeta
from langchain_core.messages import HumanMessage, SystemMessage
from schemas.image_analysis import ImageAnalysisResult
from utils.models import get_image_analysis_model
from utils.prompts import build_prompt


logger = logging.getLogger(__name__)

IMAGE_ANALYSIS_UNAVAILABLE_DESCRIPTION = (
    "An uploaded fashion image was provided, but it could not be analyzed automatically."
)

class ImageAnalysisService(metaclass=SingletonMeta):
    def describe_attachments(self, attachments: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not attachments:
            return []

        analyzed_attachments: list[dict[str, Any]] = []
        for attachment in attachments:
            analysis = self._analyze_attachment(attachment)
            if analysis is None:
                analyzed_attachments.append(
                    {
                        **attachment,
                        "analysis": None,
                        "description": IMAGE_ANALYSIS_UNAVAILABLE_DESCRIPTION,
                    }
                )
                continue

            analysis_payload = analysis.model_dump(mode="json", exclude_none=True)
            filename = str(attachment.get("filename") or "uploaded image")
            logger.info(
                "Image analysis extracted characteristics for %s: %s",
                filename,
                json.dumps(analysis_payload, ensure_ascii=True, sort_keys=True),
            )
            analyzed_attachments.append(
                {
                    **attachment,
                    "analysis": analysis_payload,
                    "description": analysis.summary,
                }
            )

        return analyzed_attachments

    def _analyze_attachment(self, attachment: dict[str, Any]) -> ImageAnalysisResult | None:
        data_url = str(attachment.get("data_url") or "")
        filename = str(attachment.get("filename") or "uploaded image")
        if not data_url:
            logger.warning("Image analysis skipped for %s because image data is missing", filename)
            return None

        try:
            sys_prompt = build_prompt(base_prompt_path="src/prompts/image_analysis/system_prompt.txt")
            llm = get_image_analysis_model().with_structured_output(ImageAnalysisResult)
            current_img_msg = HumanMessage(
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
                    )
            messages = [SystemMessage(content=sys_prompt), current_img_msg]
            response: ImageAnalysisResult = llm.invoke(messages)

            if isinstance(response, ImageAnalysisResult):
                return response
            return ImageAnalysisResult.model_validate(response)
        except Exception:
            logger.exception("Image analysis failed for attachment %s", filename)
            return None

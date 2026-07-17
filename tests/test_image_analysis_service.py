from __future__ import annotations

import unittest
from unittest.mock import patch

from schemas.image_analysis import GarmentVisualFeatures, ImageAnalysisResult
from services.image_analysis_service import (
    IMAGE_ANALYSIS_UNAVAILABLE_DESCRIPTION,
    ImageAnalysisService,
)


class _StructuredModel:
    def __init__(self, result: ImageAnalysisResult) -> None:
        self._result = result

    def invoke(self, messages):
        return self._result


class _ImageModel:
    def __init__(self, result: ImageAnalysisResult) -> None:
        self._result = result
        self.output_schema = None

    def with_structured_output(self, output_schema):
        self.output_schema = output_schema
        return _StructuredModel(self._result)


class ImageAnalysisServiceTest(unittest.TestCase):
    def test_extracts_persists_and_logs_structured_characteristics(self) -> None:
        result = ImageAnalysisResult(
            image_type="single_garment",
            garments=[
                GarmentVisualFeatures(
                    garment_type="shirt",
                    dominant_colors=["blue"],
                    pattern="striped",
                    fit="regular",
                )
            ],
            summary="A regular-fit blue striped shirt.",
        )
        image_model = _ImageModel(result)
        attachment = {
            "filename": "shirt.png",
            "content_type": "image/png",
            "data_url": "data:image/png;base64,secret-image-data",
        }

        with patch(
            "services.image_analysis_service.get_image_analysis_model",
            return_value=image_model,
        ), self.assertLogs("services.image_analysis_service", level="INFO") as logs:
            analyzed = ImageAnalysisService().describe_attachments([attachment])

        self.assertIs(image_model.output_schema, ImageAnalysisResult)
        self.assertEqual(analyzed[0]["description"], result.summary)
        self.assertEqual(analyzed[0]["analysis"], result.model_dump(mode="json", exclude_none=True))
        self.assertIn('"garment_type": "shirt"', logs.output[0])
        self.assertNotIn("secret-image-data", logs.output[0])

    def test_returns_structured_fallback_when_image_data_is_missing(self) -> None:
        analyzed = ImageAnalysisService().describe_attachments(
            [{"filename": "missing.png", "data_url": ""}]
        )

        self.assertIsNone(analyzed[0]["analysis"])
        self.assertEqual(analyzed[0]["description"], IMAGE_ANALYSIS_UNAVAILABLE_DESCRIPTION)


if __name__ == "__main__":
    unittest.main()

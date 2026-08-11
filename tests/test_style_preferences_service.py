from __future__ import annotations

import unittest

from api.schemas import ConversationStylePreferencesUpdate, StylePreferenceDetails, UserStylePreferencesUpdate
from infra.db.product_search import _request_search_text
from schemas.outfit_maker.product_solicitation import GarmentSpec
from services.search_preferences_service import SearchPreferencesService
from services.style_preferences_service import StylePreferencesService


class StylePreferencesServiceTest(unittest.TestCase):
    def test_defaults_missing_user_and_conversation_preferences(self) -> None:
        service = StylePreferencesService()

        user_preferences = service.user_preferences(None)
        conversation_preferences = service.conversation_preferences(None, None)

        self.assertTrue(user_preferences.use_personalized_styles)
        self.assertEqual(user_preferences.explicit.preferred_colors, [])
        self.assertEqual(user_preferences.inferred, [])
        self.assertIsNone(conversation_preferences.use_personalized_styles)
        self.assertTrue(conversation_preferences.effective_use_personalized_styles)

    def test_effective_context_ignores_user_memory_when_conversation_disables_it(self) -> None:
        service = StylePreferencesService()
        user_storage = service.storage_from_user_update(
            None,
            UserStylePreferencesUpdate(
                explicit=StylePreferenceDetails(
                    liked_styles=["minimalist"],
                    preferred_colors=["black"],
                )
            ),
        )
        conversation_storage = service.storage_from_conversation_update(
            None,
            ConversationStylePreferencesUpdate(
                use_personalized_styles=False,
                temporary=StylePreferenceDetails(freeform_notes="Keep this chat formal."),
            ),
        )

        context = service.effective_context(user_storage, conversation_storage)

        self.assertFalse(context.use_user_memory)
        self.assertTrue(context.enabled)
        self.assertEqual(context.sources["explicit"]["preferred_colors"], [])
        self.assertIn("Keep this chat formal", " ".join(context.guidance))
        self.assertNotIn("minimalist", " ".join(context.guidance))

    def test_current_request_color_is_not_replaced_by_remembered_color(self) -> None:
        service = StylePreferencesService()
        user_storage = service.storage_from_user_update(
            None,
            UserStylePreferencesUpdate(
                explicit=StylePreferenceDetails(preferred_colors=["black"])
            ),
        )
        context = service.effective_context(user_storage, None).model_dump(mode="json")
        garment = GarmentSpec(kind="garment", base_colors=["yellow"], article_types=["Jackets"])

        query = _request_search_text(garment, context)

        self.assertIn("yellow", query)
        self.assertNotIn("black", query)

    def test_search_priorities_remain_separate_from_style_memory(self) -> None:
        service = SearchPreferencesService()

        priority_fields = service.conversation_priority_fields(
            None,
            {"priority_fields": ["gender", "category"]},
        )

        self.assertEqual(priority_fields, ["gender", "category"])

    def test_explicit_preferences_outrank_learned_inferred_preferences(self) -> None:
        service = StylePreferencesService()
        user_storage = service.storage_from_user_update(
            None,
            UserStylePreferencesUpdate(
                explicit=StylePreferenceDetails(preferred_brands=["Adidas"]),
                inferred=[
                    {
                        "kind": "preferred_brand",
                        "value": "Nike",
                        "confidence": 0.9,
                        "evidence": "Repeated Nike requests.",
                    }
                ],
            ),
        )

        context = service.effective_context(user_storage, None)

        self.assertIn("Adidas", " ".join(context.guidance))
        self.assertNotIn("Nike", " ".join(context.guidance))

    def test_conversation_temporary_preferences_outrank_durable_memory(self) -> None:
        service = StylePreferencesService()
        user_storage = service.storage_from_user_update(
            None,
            UserStylePreferencesUpdate(explicit=StylePreferenceDetails(liked_styles=["casual"])),
        )
        conversation_storage = service.storage_from_conversation_update(
            None,
            ConversationStylePreferencesUpdate(temporary=StylePreferenceDetails(liked_styles=["formal"])),
        )

        context = service.effective_context(user_storage, conversation_storage)

        self.assertIn("formal", " ".join(context.guidance))
        self.assertNotIn("casual", " ".join(context.guidance))


if __name__ == "__main__":
    unittest.main()

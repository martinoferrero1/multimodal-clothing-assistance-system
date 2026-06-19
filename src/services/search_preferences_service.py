from __future__ import annotations

from typing import Any

from core.metaclasses.singleton_meta import SingletonMeta
from core.settings import settings
from schemas.outfit_maker.product_solicitation import (
    SearchPriorityField,
    normalize_priority_fields,
)


class SearchPreferencesService(metaclass=SingletonMeta):
    def default_priority_fields(self) -> list[SearchPriorityField]:
        return self.normalize_fields(settings.PRODUCT_SEARCH_PRIORITY_FIELDS)

    def normalize_fields(self, value: Any) -> list[SearchPriorityField]:
        return list(normalize_priority_fields(value) or [])

    def storage_from_fields(self, fields: Any) -> dict[str, list[SearchPriorityField]]:
        return {"priority_fields": self.normalize_fields(fields)}

    def user_priority_fields(self, raw_preferences: dict | None) -> list[SearchPriorityField]:
        stored_fields = self._fields_from_storage(raw_preferences)
        if stored_fields is not None:
            return stored_fields
        return self.default_priority_fields()

    def conversation_override_fields(
        self,
        raw_preferences: dict | None,
    ) -> list[SearchPriorityField] | None:
        return self._fields_from_storage(raw_preferences)

    def conversation_priority_fields(
        self,
        conversation_preferences: dict | None,
        user_preferences: dict | None,
    ) -> list[SearchPriorityField]:
        override_fields = self.conversation_override_fields(conversation_preferences)
        if override_fields is not None:
            return override_fields
        return self.user_priority_fields(user_preferences)

    def _fields_from_storage(
        self,
        raw_preferences: dict | None,
    ) -> list[SearchPriorityField] | None:
        if raw_preferences is None:
            return None
        if not isinstance(raw_preferences, dict):
            return []
        return self.normalize_fields(raw_preferences.get("priority_fields", []))


def get_search_preferences_service() -> SearchPreferencesService:
    return SearchPreferencesService()

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from api.schemas import (
    ConversationStylePreferencesRead,
    ConversationStylePreferencesUpdate,
    InferredStylePreferenceRead,
    InferredStylePreferenceUpdate,
    StylePreferenceContextRead,
    StylePreferenceDetails,
    UserStylePreferencesRead,
    UserStylePreferencesUpdate,
)
from core.metaclasses.singleton_meta import SingletonMeta


STYLE_PRECEDENCE = [
    "latest_user_request",
    "conversation_temporary",
    "user_explicit",
    "user_inferred",
    "defaults",
]


class StylePreferencesService(metaclass=SingletonMeta):
    def user_preferences(self, raw_preferences: dict | None) -> UserStylePreferencesRead:
        if not isinstance(raw_preferences, dict):
            return UserStylePreferencesRead()

        return UserStylePreferencesRead(
            use_personalized_styles=bool(raw_preferences.get("use_personalized_styles", True)),
            explicit=self._details_from_storage(raw_preferences.get("explicit")),
            inferred=self._inferred_from_storage(raw_preferences.get("inferred")),
        )

    def conversation_preferences(
        self,
        raw_preferences: dict | None,
        user_preferences: dict | None,
    ) -> ConversationStylePreferencesRead:
        user_read = self.user_preferences(user_preferences)
        if not isinstance(raw_preferences, dict):
            return ConversationStylePreferencesRead(
                effective_use_personalized_styles=user_read.use_personalized_styles,
            )

        override = raw_preferences.get("use_personalized_styles")
        if override is not None:
            override = bool(override)
        return ConversationStylePreferencesRead(
            use_personalized_styles=override,
            effective_use_personalized_styles=(
                override if override is not None else user_read.use_personalized_styles
            ),
            temporary=self._details_from_storage(raw_preferences.get("temporary")),
        )

    def storage_from_user_update(
        self,
        raw_preferences: dict | None,
        payload: UserStylePreferencesUpdate,
    ) -> dict[str, Any]:
        current = self.user_preferences(raw_preferences)
        use_personalized_styles = (
            payload.use_personalized_styles
            if payload.use_personalized_styles is not None
            else current.use_personalized_styles
        )
        explicit = payload.explicit or current.explicit
        inferred = (
            self._build_inferred_entries(payload.inferred)
            if payload.inferred is not None
            else current.inferred
        )
        return self._user_storage(use_personalized_styles, explicit, inferred)

    def storage_with_cleared_explicit(self, raw_preferences: dict | None) -> dict[str, Any]:
        current = self.user_preferences(raw_preferences)
        return self._user_storage(
            current.use_personalized_styles,
            StylePreferenceDetails(),
            current.inferred,
        )

    def storage_without_inferred(
        self,
        raw_preferences: dict | None,
        inferred_id: str,
    ) -> tuple[dict[str, Any], bool]:
        current = self.user_preferences(raw_preferences)
        remaining = [entry for entry in current.inferred if entry.id != inferred_id]
        removed = len(remaining) != len(current.inferred)
        return self._user_storage(current.use_personalized_styles, current.explicit, remaining), removed

    def storage_from_conversation_update(
        self,
        raw_preferences: dict | None,
        payload: ConversationStylePreferencesUpdate,
    ) -> dict[str, Any]:
        current_override = None
        current_temporary = StylePreferenceDetails()
        if isinstance(raw_preferences, dict):
            current_override = raw_preferences.get("use_personalized_styles")
            if current_override is not None:
                current_override = bool(current_override)
            current_temporary = self._details_from_storage(raw_preferences.get("temporary"))

        override = payload.use_personalized_styles
        if override is None:
            override = current_override
        temporary = payload.temporary or current_temporary
        return {
            "use_personalized_styles": override,
            "temporary": temporary.model_dump(mode="json"),
        }

    def effective_context(
        self,
        user_preferences: dict | None,
        conversation_preferences: dict | None,
    ) -> StylePreferenceContextRead:
        user_read = self.user_preferences(user_preferences)
        conversation_read = self.conversation_preferences(conversation_preferences, user_preferences)
        use_user_memory = conversation_read.effective_use_personalized_styles

        guidance: list[str] = []
        temporary_guidance = self._details_guidance(conversation_read.temporary, "For this conversation")
        guidance.extend(temporary_guidance)

        explicit = user_read.explicit if use_user_memory else StylePreferenceDetails()
        inferred = user_read.inferred if use_user_memory else []
        if use_user_memory:
            guidance.extend(self._details_guidance(user_read.explicit, "User generally"))
            guidance.extend(self._inferred_guidance(user_read.inferred))

        sources = {
            "temporary": conversation_read.temporary.model_dump(mode="json"),
            "explicit": explicit.model_dump(mode="json"),
            "inferred": [entry.model_dump(mode="json") for entry in inferred],
        }
        return StylePreferenceContextRead(
            enabled=bool(guidance),
            use_user_memory=use_user_memory,
            guidance=guidance,
            sources=sources,
            precedence=STYLE_PRECEDENCE,
        )

    def _details_from_storage(self, value: Any) -> StylePreferenceDetails:
        if not isinstance(value, dict):
            return StylePreferenceDetails()
        return StylePreferenceDetails.model_validate(value)

    def _inferred_from_storage(self, value: Any) -> list[InferredStylePreferenceRead]:
        if not isinstance(value, list):
            return []

        entries: list[InferredStylePreferenceRead] = []
        for item in value:
            if not isinstance(item, dict):
                continue
            kind = str(item.get("kind") or "").strip()
            inferred_value = str(item.get("value") or "").strip()
            if not kind or not inferred_value:
                continue
            try:
                confidence = float(item.get("confidence", 0.5))
            except (TypeError, ValueError):
                confidence = 0.5
            entries.append(
                InferredStylePreferenceRead(
                    id=str(item.get("id") or uuid.uuid4()),
                    kind=kind,
                    value=inferred_value,
                    confidence=max(0.0, min(1.0, confidence)),
                    evidence=self._clean_note(item.get("evidence")),
                    created_at=self._clean_note(item.get("created_at")),
                    updated_at=self._clean_note(item.get("updated_at")),
                )
            )
        return entries

    def _build_inferred_entries(
        self,
        values: list[InferredStylePreferenceUpdate],
    ) -> list[InferredStylePreferenceRead]:
        timestamp = datetime.now(UTC).isoformat()
        entries: list[InferredStylePreferenceRead] = []
        for value in values:
            entries.append(
                InferredStylePreferenceRead(
                    id=str(uuid.uuid4()),
                    kind=value.kind.strip(),
                    value=value.value.strip(),
                    confidence=value.confidence,
                    evidence=self._clean_note(value.evidence),
                    created_at=timestamp,
                    updated_at=timestamp,
                )
            )
        return entries

    def _user_storage(
        self,
        use_personalized_styles: bool,
        explicit: StylePreferenceDetails,
        inferred: list[InferredStylePreferenceRead],
    ) -> dict[str, Any]:
        return {
            "use_personalized_styles": bool(use_personalized_styles),
            "explicit": explicit.model_dump(mode="json"),
            "inferred": [entry.model_dump(mode="json") for entry in inferred],
        }

    def _details_guidance(self, details: StylePreferenceDetails, prefix: str) -> list[str]:
        guidance: list[str] = []
        if details.liked_styles:
            guidance.append(f"{prefix} likes these styles when not conflicting: {', '.join(details.liked_styles)}.")
        if details.disliked_styles:
            guidance.append(f"{prefix} avoids these styles unless requested: {', '.join(details.disliked_styles)}.")
        if details.preferred_colors:
            guidance.append(f"{prefix} prefers these colors when the request is silent: {', '.join(details.preferred_colors)}.")
        if details.avoided_colors:
            guidance.append(f"{prefix} avoids these colors unless requested: {', '.join(details.avoided_colors)}.")
        if details.preferred_brands:
            guidance.append(f"{prefix} prefers these brands when suitable: {', '.join(details.preferred_brands)}.")
        if details.avoided_brands:
            guidance.append(f"{prefix} avoids these brands unless requested: {', '.join(details.avoided_brands)}.")
        if details.preferred_fits:
            guidance.append(f"{prefix} prefers these fits: {', '.join(details.preferred_fits)}.")
        if details.occasions:
            guidance.append(f"{prefix} often shops for these occasions: {', '.join(details.occasions)}.")
        for label, note in (
            ("budget notes", details.budget_notes),
            ("sizing notes", details.sizing_notes),
            ("style notes", details.freeform_notes),
        ):
            if note:
                guidance.append(f"{prefix} has {label}: {note}.")
        return guidance

    def _inferred_guidance(self, entries: list[InferredStylePreferenceRead]) -> list[str]:
        guidance: list[str] = []
        for entry in entries:
            if entry.confidence < 0.35:
                continue
            guidance.append(
                f"Inferred preference ({entry.confidence:.0%} confidence): {entry.kind} = {entry.value}."
            )
        return guidance

    def _clean_note(self, value: Any) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None


def get_style_preferences_service() -> StylePreferencesService:
    return StylePreferencesService()

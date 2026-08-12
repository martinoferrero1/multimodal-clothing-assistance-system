from __future__ import annotations

from datetime import datetime
from typing import Any
import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic import field_validator, model_validator
from schemas.image_analysis import ImageAnalysisResult
from schemas.outfit_maker.product_solicitation import (
    SearchPriorityField,
    normalize_priority_fields,
)


class SearchPreferencesRead(BaseModel):
    priority_fields: list[SearchPriorityField] = Field(default_factory=list)


class SearchPreferencesUpdate(BaseModel):
    priority_fields: list[SearchPriorityField] = Field(default_factory=list)

    @field_validator("priority_fields", mode="before")
    @classmethod
    def clean_priority_fields(cls, value: Any) -> list[SearchPriorityField]:
        return list(normalize_priority_fields(value) or [])


class ConversationSearchPreferencesRead(BaseModel):
    priority_fields: list[SearchPriorityField] | None = None
    effective_priority_fields: list[SearchPriorityField] = Field(default_factory=list)


class ConversationSearchPreferencesUpdate(BaseModel):
    priority_fields: list[SearchPriorityField] | None = None

    @field_validator("priority_fields", mode="before")
    @classmethod
    def clean_priority_fields(cls, value: Any) -> list[SearchPriorityField] | None:
        if value is None:
            return None
        return list(normalize_priority_fields(value) or [])


def _clean_string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        raw_items = [item.strip() for item in value.replace(";", ",").split(",")]
    else:
        raw_items = list(value)

    cleaned: list[str] = []
    seen: set[str] = set()
    for item in raw_items:
        normalized = str(item).strip()
        if not normalized:
            continue
        dedupe_key = normalized.casefold()
        if dedupe_key in seen:
            continue
        cleaned.append(normalized)
        seen.add(dedupe_key)
    return cleaned


def _clean_optional_note(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


class StylePreferenceDetails(BaseModel):
    liked_styles: list[str] = Field(default_factory=list)
    disliked_styles: list[str] = Field(default_factory=list)
    preferred_colors: list[str] = Field(default_factory=list)
    avoided_colors: list[str] = Field(default_factory=list)
    preferred_brands: list[str] = Field(default_factory=list)
    avoided_brands: list[str] = Field(default_factory=list)
    preferred_fits: list[str] = Field(default_factory=list)
    occasions: list[str] = Field(default_factory=list)
    budget_notes: str | None = None
    sizing_notes: str | None = None
    freeform_notes: str | None = None

    @field_validator(
        "liked_styles",
        "disliked_styles",
        "preferred_colors",
        "avoided_colors",
        "preferred_brands",
        "avoided_brands",
        "preferred_fits",
        "occasions",
        mode="before",
    )
    @classmethod
    def clean_list_fields(cls, value: Any) -> list[str]:
        return _clean_string_list(value)

    @field_validator("budget_notes", "sizing_notes", "freeform_notes", mode="before")
    @classmethod
    def clean_note_fields(cls, value: Any) -> str | None:
        return _clean_optional_note(value)


class InferredStylePreferenceRead(BaseModel):
    id: str
    kind: str
    value: str
    confidence: float = Field(ge=0, le=1)
    evidence: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    source: str | None = None
    field: str | None = None
    polarity: str | None = None
    occurrence_count: int | None = None
    first_seen_at: str | None = None
    last_seen_at: str | None = None
    score: float | None = None
    aggregate_id: str | None = None


class InferredStylePreferenceUpdate(BaseModel):
    kind: str
    value: str
    confidence: float = Field(default=0.5, ge=0, le=1)
    evidence: str | None = None

    @field_validator("kind", "value", "evidence", mode="before")
    @classmethod
    def clean_text_fields(cls, value: Any) -> str | None:
        return _clean_optional_note(value)


class UserStylePreferencesRead(BaseModel):
    use_personalized_styles: bool = True
    explicit: StylePreferenceDetails = Field(default_factory=StylePreferenceDetails)
    inferred: list[InferredStylePreferenceRead] = Field(default_factory=list)


class UserStylePreferencesUpdate(BaseModel):
    use_personalized_styles: bool | None = None
    explicit: StylePreferenceDetails | None = None
    inferred: list[InferredStylePreferenceUpdate] | None = None


class ConversationStylePreferencesRead(BaseModel):
    use_personalized_styles: bool | None = None
    effective_use_personalized_styles: bool = True
    temporary: StylePreferenceDetails = Field(default_factory=StylePreferenceDetails)


class ConversationStylePreferencesUpdate(BaseModel):
    use_personalized_styles: bool | None = None
    temporary: StylePreferenceDetails | None = None


class StylePreferenceContextRead(BaseModel):
    enabled: bool = False
    use_user_memory: bool = True
    guidance: list[str] = Field(default_factory=list)
    sources: dict[str, Any] = Field(default_factory=dict)
    precedence: list[str] = Field(default_factory=list)


class UserRegister(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    display_name: str
    email: EmailStr | None = None
    search_preferences: SearchPreferencesRead
    style_preferences: UserStylePreferencesRead
    created_at: datetime


class AuthToken(BaseModel):
    access_token: str
    token_type: str
    expires_at: datetime


class AuthResponse(BaseModel):
    token: AuthToken
    user: UserRead


class ConversationCreate(BaseModel):
    title: str | None = Field(default=None, max_length=160)


class ConversationUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=160)
    is_pinned: bool | None = None

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Conversation title cannot be empty")
        return cleaned

    @model_validator(mode="after")
    def require_change(self):
        if self.title is None and self.is_pinned is None:
            raise ValueError("At least one conversation field must be provided")
        return self


class ConversationOrderUpdate(BaseModel):
    conversation_ids: list[str] = Field(min_length=1)

    @field_validator("conversation_ids")
    @classmethod
    def unique_conversation_ids(cls, value: list[str]) -> list[str]:
        if len(value) != len(set(value)):
            raise ValueError("Conversation order cannot contain duplicate IDs")
        return value


class ConversationRead(BaseModel):
    id: str
    user_id: str
    title: str
    is_pinned: bool = False
    summary: str | None = None
    search_preferences: ConversationSearchPreferencesRead
    style_preferences: ConversationStylePreferencesRead
    message_count: int = 0
    last_message_preview: str | None = None
    created_at: datetime
    updated_at: datetime


class MessageCreate(BaseModel):
    content: str = Field(min_length=1)


class MessageImageAttachment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    content_type: str
    data_url: str
    description: str | None = None
    analysis: ImageAnalysisResult | None = None


class ChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    role: str
    content: str
    attachments: list[MessageImageAttachment] | None = None
    final_response_payload: dict | None = None
    workflow_errors: list[dict] | None = None
    created_at: datetime


class ChatTurnResponse(BaseModel):
    conversation_id: str
    user_message: ChatMessageRead
    assistant_message: ChatMessageRead


class HealthResponse(BaseModel):
    status: str

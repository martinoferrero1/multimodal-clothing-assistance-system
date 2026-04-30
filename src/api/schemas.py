from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)
    email: EmailStr | None = None


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    display_name: str
    email: EmailStr | None = None
    created_at: datetime


class ConversationCreate(BaseModel):
    title: str | None = Field(default=None, max_length=160)


class ConversationRead(BaseModel):
    id: str
    user_id: str
    title: str
    summary: str | None = None
    message_count: int = 0
    last_message_preview: str | None = None
    created_at: datetime
    updated_at: datetime


class MessageCreate(BaseModel):
    content: str = Field(min_length=1)


class ChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    role: str
    content: str
    final_response_payload: dict | None = None
    workflow_errors: list[dict] | None = None
    created_at: datetime


class ChatTurnResponse(BaseModel):
    conversation_id: str
    user_message: ChatMessageRead
    assistant_message: ChatMessageRead


class HealthResponse(BaseModel):
    status: str

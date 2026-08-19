from __future__ import annotations

import uuid
from datetime import UTC, datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint, case, false, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infra.db.models.base import Base


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


class ChatUser(Base):
    __tablename__ = "chat_users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    search_preferences: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    style_preferences: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    conversations: Mapped[list["Conversation"]] = relationship(
        "Conversation",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    auth_sessions: Mapped[list["AuthSession"]] = relationship(
        "AuthSession",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    __table_args__ = (
        UniqueConstraint("token_hash", name="uq_auth_sessions_token_hash"),
        Index("ix_auth_sessions_user_revoked", "user_id", "revoked_at"),
        Index("ix_auth_sessions_expiry", "idle_expires_at", "absolute_expires_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        ForeignKey("chat_users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    idle_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    absolute_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoke_reason: Mapped[str | None] = mapped_column(String(32), nullable=True)

    user: Mapped["ChatUser"] = relationship("ChatUser", back_populates="auth_sessions")


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("chat_users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False, default="New conversation")
    is_pinned: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=false(),
    )
    sidebar_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_message_count: Mapped[int] = mapped_column(default=0, nullable=False)
    search_preferences: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    style_preferences: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["ChatUser"] = relationship("ChatUser", back_populates="conversations")
    messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by=lambda: (
            ChatMessage.created_at.asc(),
            case((ChatMessage.role == MessageRole.USER.value, 0), else_=1).asc(),
            ChatMessage.id.asc(),
        ),
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("conversations.id"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    attachments: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    final_response_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    workflow_errors: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
        nullable=False,
    )

    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")


class UserPreferenceSignal(Base):
    __tablename__ = "user_preference_signals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("chat_users.id"), nullable=False, index=True)
    conversation_id: Mapped[str | None] = mapped_column(ForeignKey("conversations.id"), nullable=True, index=True)
    message_id: Mapped[str | None] = mapped_column(ForeignKey("chat_messages.id"), nullable=True, index=True)
    field: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_value: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    polarity: Mapped[str] = mapped_column(String(20), nullable=False, default="positive")
    source: Mapped[str] = mapped_column(String(40), nullable=False)
    strength: Mapped[float] = mapped_column(Float, nullable=False)
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)
    observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
        nullable=False,
    )


class UserPreferenceAggregate(Base):
    __tablename__ = "user_preference_aggregates"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "field",
            "normalized_value",
            "polarity",
            name="uq_user_preference_aggregate_value",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("chat_users.id"), nullable=False, index=True)
    field: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_value: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    polarity: Mapped[str] = mapped_column(String(20), nullable=False, default="positive")
    observation_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    weighted_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    recent_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)
    first_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    suppressed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    suppressed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        server_default=func.now(),
        nullable=False,
    )

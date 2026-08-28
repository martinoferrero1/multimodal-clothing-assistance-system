from __future__ import annotations

import uuid
from datetime import UTC, datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    PrimaryKeyConstraint,
    String,
    Text,
    UniqueConstraint,
    case,
    false,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infra.db.models.base import Base


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


class StoreStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


class StoreMembershipRole(str, Enum):
    OWNER = "owner"


class ChatUser(Base):
    __tablename__ = "chat_users"
    __table_args__ = (
        CheckConstraint(
            "account_kind IN ('consumer', 'guest')",
            name="ck_chat_users_account_kind",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    account_kind: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="consumer",
        server_default="consumer",
    )
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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
    store_memberships: Mapped[list["StoreMembership"]] = relationship(
        "StoreMembership",
        back_populates="user",
    )
    mfa_credentials: Mapped[list["UserMfaCredential"]] = relationship(
        "UserMfaCredential",
        back_populates="user",
    )
    store_security_events_as_actor: Mapped[list["StoreSecurityEvent"]] = relationship(
        "StoreSecurityEvent",
        back_populates="actor",
        foreign_keys="StoreSecurityEvent.actor_user_id",
    )
    store_security_events_as_target: Mapped[list["StoreSecurityEvent"]] = relationship(
        "StoreSecurityEvent",
        back_populates="target_user",
        foreign_keys="StoreSecurityEvent.target_user_id",
    )


class Store(Base):
    __tablename__ = "stores"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="pk_stores"),
        UniqueConstraint("public_handle", name="uq_stores_public_handle"),
        UniqueConstraint(
            "jurisdiction",
            "business_identifier",
            name="uq_stores_jurisdiction_business_identifier",
        ),
        CheckConstraint(
            "status IN ('pending', 'active', 'rejected', 'suspended')",
            name="ck_stores_status",
        ),
        Index("ix_stores_status", "status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    legal_name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    public_handle: Mapped[str] = mapped_column(String(120), nullable=False)
    jurisdiction: Mapped[str] = mapped_column(String(64), nullable=False)
    business_identifier: Mapped[str] = mapped_column(String(128), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    contact_email: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_phone: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=StoreStatus.PENDING.value,
        server_default=StoreStatus.PENDING.value,
    )
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

    memberships: Mapped[list["StoreMembership"]] = relationship(
        "StoreMembership",
        back_populates="store",
        cascade="all, delete-orphan",
    )
    verification_tokens: Mapped[list["StoreVerificationToken"]] = relationship(
        "StoreVerificationToken",
        back_populates="store",
        cascade="all, delete-orphan",
    )
    mfa_credentials: Mapped[list["UserMfaCredential"]] = relationship(
        "UserMfaCredential",
        back_populates="store",
        cascade="all, delete-orphan",
    )
    security_events: Mapped[list["StoreSecurityEvent"]] = relationship(
        "StoreSecurityEvent",
        back_populates="store",
        cascade="all, delete-orphan",
    )
    active_sessions: Mapped[list["AuthSession"]] = relationship(
        "AuthSession",
        back_populates="active_store",
    )


class StoreMembership(Base):
    __tablename__ = "store_memberships"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="pk_store_memberships"),
        UniqueConstraint("store_id", "user_id", name="uq_store_memberships_store_user"),
        CheckConstraint("role = 'owner'", name="ck_store_memberships_role"),
        Index("ix_store_memberships_store_active", "store_id", "revoked_at"),
        Index("ix_store_memberships_user_active", "user_id", "revoked_at"),
        Index(
            "uq_store_memberships_active_owner",
            "store_id",
            unique=True,
            postgresql_where=text("role = 'owner' AND revoked_at IS NULL"),
            sqlite_where=text("role = 'owner' AND revoked_at IS NULL"),
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(
        ForeignKey("stores.id", name="fk_store_memberships_store_id_stores", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("chat_users.id", name="fk_store_memberships_user_id_chat_users", ondelete="RESTRICT"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(String(32), nullable=False, default=StoreMembershipRole.OWNER.value)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoke_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)

    store: Mapped["Store"] = relationship("Store", back_populates="memberships")
    user: Mapped["ChatUser"] = relationship("ChatUser", back_populates="store_memberships")


class StoreVerificationToken(Base):
    __tablename__ = "store_verification_tokens"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="pk_store_verification_tokens"),
        UniqueConstraint("token_hash", name="uq_store_verification_tokens_token_hash"),
        CheckConstraint(
            "purpose = 'email_verification'",
            name="ck_store_verification_tokens_purpose",
        ),
        Index(
            "ix_store_verification_tokens_store_user_pending",
            "store_id",
            "user_id",
            "consumed_at",
            "expires_at",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(
        ForeignKey("stores.id", name="fk_store_verification_tokens_store_id_stores", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("chat_users.id", name="fk_store_verification_tokens_user_id_chat_users", ondelete="RESTRICT"),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    purpose: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="email_verification",
        server_default="email_verification",
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    store: Mapped["Store"] = relationship("Store", back_populates="verification_tokens")
    user: Mapped["ChatUser"] = relationship("ChatUser")


class UserMfaCredential(Base):
    __tablename__ = "user_mfa_credentials"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="pk_user_mfa_credentials"),
        UniqueConstraint("store_id", "user_id", name="uq_user_mfa_credentials_store_user"),
        Index("ix_user_mfa_credentials_store_user_active", "store_id", "user_id", "revoked_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(
        ForeignKey("stores.id", name="fk_user_mfa_credentials_store_id_stores", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("chat_users.id", name="fk_user_mfa_credentials_user_id_chat_users", ondelete="RESTRICT"),
        nullable=False,
    )
    secret_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    store: Mapped["Store"] = relationship("Store", back_populates="mfa_credentials")
    user: Mapped["ChatUser"] = relationship("ChatUser", back_populates="mfa_credentials")


class StoreSecurityEvent(Base):
    __tablename__ = "store_security_events"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="pk_store_security_events"),
        Index("ix_store_security_events_store_created", "store_id", "created_at"),
        Index("ix_store_security_events_actor_created", "actor_user_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(
        ForeignKey("stores.id", name="fk_store_security_events_store_id_stores", ondelete="CASCADE"),
        nullable=False,
    )
    actor_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("chat_users.id", name="fk_store_security_events_actor_user_id_chat_users", ondelete="SET NULL"),
        nullable=True,
    )
    target_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("chat_users.id", name="fk_store_security_events_target_user_id_chat_users", ondelete="SET NULL"),
        nullable=True,
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    outcome: Mapped[str] = mapped_column(String(32), nullable=False)
    correlation_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    event_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    store: Mapped["Store"] = relationship("Store", back_populates="security_events")
    actor: Mapped["ChatUser | None"] = relationship(
        "ChatUser",
        back_populates="store_security_events_as_actor",
        foreign_keys=[actor_user_id],
    )
    target_user: Mapped["ChatUser | None"] = relationship(
        "ChatUser",
        back_populates="store_security_events_as_target",
        foreign_keys=[target_user_id],
    )


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    __table_args__ = (
        UniqueConstraint("token_hash", name="uq_auth_sessions_token_hash"),
        Index("ix_auth_sessions_user_revoked", "user_id", "revoked_at"),
        Index("ix_auth_sessions_expiry", "idle_expires_at", "absolute_expires_at"),
        Index("ix_auth_sessions_active_store_revoked", "active_store_id", "revoked_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        ForeignKey("chat_users.id", ondelete="CASCADE"), nullable=False
    )
    active_store_id: Mapped[str | None] = mapped_column(
        ForeignKey("stores.id", name="fk_auth_sessions_active_store_id_stores", ondelete="SET NULL"),
        nullable=True,
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    idle_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    absolute_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoke_reason: Mapped[str | None] = mapped_column(String(32), nullable=True)

    user: Mapped["ChatUser"] = relationship("ChatUser", back_populates="auth_sessions")
    active_store: Mapped["Store | None"] = relationship("Store", back_populates="active_sessions")


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

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, PrimaryKeyConstraint, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from infra.db.models.base import Base


class StoreCommunityListing(Base):
    __tablename__ = "store_community_listings"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="pk_store_community_listings"),
        CheckConstraint("kind IN ('blog', 'event', 'space')", name="ck_store_community_listings_kind"),
        Index("ix_store_community_listings_store_updated", "store_id", "updated_at"),
        Index("ix_store_community_listings_public_kind_start", "kind", "starts_at"),
        Index("uq_store_community_listings_join_code", "join_code", unique=True),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(
        ForeignKey("stores.id", name="fk_store_community_listings_store_id_stores", ondelete="CASCADE"),
        nullable=False,
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    external_url: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    join_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), server_default=func.now(), nullable=False
    )


class StoreCommunitySubscription(Base):
    __tablename__ = "store_community_subscriptions"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="pk_store_community_subscriptions"),
        UniqueConstraint("listing_id", "user_id", name="uq_store_community_subscriptions_listing_user"),
        Index("ix_store_community_subscriptions_user_created", "user_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    listing_id: Mapped[str] = mapped_column(
        ForeignKey("store_community_listings.id", name="fk_store_community_subscriptions_listing_id_listings", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("chat_users.id", name="fk_store_community_subscriptions_user_id_chat_users", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now(), nullable=False
    )

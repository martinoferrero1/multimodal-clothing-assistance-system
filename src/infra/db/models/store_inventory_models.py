from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Index, JSON, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infra.db.models.base import Base


class StoreInventoryItem(Base):
    __tablename__ = "store_inventory_items"
    __table_args__ = (
        UniqueConstraint("store_id", "external_id", name="uq_store_inventory_items_store_external_id"),
        Index("ix_store_inventory_items_store_updated", "store_id", "updated_at"),
        Index("ix_store_inventory_items_store_name", "store_id", "product_display_name"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id: Mapped[str] = mapped_column(
        ForeignKey("stores.id", name="fk_store_inventory_items_store_id_stores", ondelete="CASCADE"),
        nullable=False,
    )
    external_id: Mapped[str] = mapped_column(String(128), nullable=False)
    product_display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    gender: Mapped[str | None] = mapped_column(String(80), nullable=True)
    master_category: Mapped[str | None] = mapped_column(String(120), nullable=True)
    sub_category: Mapped[str | None] = mapped_column(String(120), nullable=True)
    article_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    base_colour: Mapped[str | None] = mapped_column(String(120), nullable=True)
    colour1: Mapped[str | None] = mapped_column(String(120), nullable=True)
    colour2: Mapped[str | None] = mapped_column(String(120), nullable=True)
    season: Mapped[str | None] = mapped_column(String(80), nullable=True)
    year: Mapped[int | None] = mapped_column(nullable=True)
    usage: Mapped[str | None] = mapped_column(String(120), nullable=True)
    brand: Mapped[str | None] = mapped_column(String(120), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    image_top: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    image_back: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    image_search: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    image_default: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    image_left: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    image_front: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    image_right: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), server_default=func.now(), nullable=False
    )

    store: Mapped["Store"] = relationship("Store")

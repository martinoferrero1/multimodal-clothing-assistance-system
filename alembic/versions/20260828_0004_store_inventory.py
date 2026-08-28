"""Add private store inventory.

Revision ID: 20260828_0004
Revises: 20260825_0003
Create Date: 2026-08-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260828_0004"
down_revision: Union[str, None] = "20260825_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "store_inventory_items",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("store_id", sa.String(length=36), nullable=False),
        sa.Column("external_id", sa.String(length=128), nullable=False),
        sa.Column("product_display_name", sa.String(length=255), nullable=False),
        sa.Column("price", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("gender", sa.String(length=80), nullable=True),
        sa.Column("master_category", sa.String(length=120), nullable=True),
        sa.Column("sub_category", sa.String(length=120), nullable=True),
        sa.Column("article_type", sa.String(length=120), nullable=True),
        sa.Column("base_colour", sa.String(length=120), nullable=True),
        sa.Column("colour1", sa.String(length=120), nullable=True),
        sa.Column("colour2", sa.String(length=120), nullable=True),
        sa.Column("season", sa.String(length=80), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("usage", sa.String(length=120), nullable=True),
        sa.Column("brand", sa.String(length=120), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("image_top", sa.String(length=4096), nullable=True),
        sa.Column("image_back", sa.String(length=4096), nullable=True),
        sa.Column("image_search", sa.String(length=4096), nullable=True),
        sa.Column("image_default", sa.String(length=4096), nullable=True),
        sa.Column("image_left", sa.String(length=4096), nullable=True),
        sa.Column("image_front", sa.String(length=4096), nullable=True),
        sa.Column("image_right", sa.String(length=4096), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], name="fk_store_inventory_items_store_id_stores", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_store_inventory_items"),
        sa.UniqueConstraint("store_id", "external_id", name="uq_store_inventory_items_store_external_id"),
    )
    op.create_index("ix_store_inventory_items_store_updated", "store_inventory_items", ["store_id", "updated_at"], unique=False)
    op.create_index("ix_store_inventory_items_store_name", "store_inventory_items", ["store_id", "product_display_name"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    item_count = bind.execute(sa.text("SELECT COUNT(*) FROM store_inventory_items")).scalar_one()
    store_count = bind.execute(sa.text("SELECT COUNT(*) FROM stores")).scalar_one()
    if item_count or store_count:
        raise RuntimeError(
            "Store inventory downgrade would discard data: inventory data or a following store downgrade could discard store data. "
            "Remove the commercial data explicitly before downgrading."
        )
    op.drop_index("ix_store_inventory_items_store_name", table_name="store_inventory_items")
    op.drop_index("ix_store_inventory_items_store_updated", table_name="store_inventory_items")
    op.drop_table("store_inventory_items")

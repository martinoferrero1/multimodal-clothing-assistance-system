"""Add store community listings and subscriptions.

Revision ID: 20260918_0005
Revises: 20260828_0004
Create Date: 2026-09-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260918_0005"
down_revision: Union[str, None] = "20260828_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "store_community_listings",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("store_id", sa.String(length=36), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("external_url", sa.String(length=4096), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.CheckConstraint("kind IN ('blog', 'event', 'space')", name="ck_store_community_listings_kind"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], name="fk_store_community_listings_store_id_stores", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_store_community_listings"),
    )
    op.create_index("ix_store_community_listings_store_updated", "store_community_listings", ["store_id", "updated_at"], unique=False)
    op.create_index("ix_store_community_listings_public_kind_start", "store_community_listings", ["kind", "starts_at"], unique=False)
    op.create_table(
        "store_community_subscriptions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("listing_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["listing_id"], ["store_community_listings.id"], name="fk_store_community_subscriptions_listing_id_listings", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["chat_users.id"], name="fk_store_community_subscriptions_user_id_chat_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_store_community_subscriptions"),
        sa.UniqueConstraint("listing_id", "user_id", name="uq_store_community_subscriptions_listing_user"),
    )
    op.create_index("ix_store_community_subscriptions_user_created", "store_community_subscriptions", ["user_id", "created_at"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    subscription_count = bind.execute(sa.text("SELECT COUNT(*) FROM store_community_subscriptions")).scalar_one()
    listing_count = bind.execute(sa.text("SELECT COUNT(*) FROM store_community_listings")).scalar_one()
    inventory_count = bind.execute(sa.text("SELECT COUNT(*) FROM store_inventory_items")).scalar_one()
    store_count = bind.execute(sa.text("SELECT COUNT(*) FROM stores")).scalar_one()
    if subscription_count or listing_count or inventory_count or store_count:
        raise RuntimeError(
            "Store community downgrade would discard data or leave a partial commercial downgrade. "
            "Remove commercial data explicitly before downgrading."
        )
    op.drop_index("ix_store_community_subscriptions_user_created", table_name="store_community_subscriptions")
    op.drop_table("store_community_subscriptions")
    op.drop_index("ix_store_community_listings_public_kind_start", table_name="store_community_listings")
    op.drop_index("ix_store_community_listings_store_updated", table_name="store_community_listings")
    op.drop_table("store_community_listings")

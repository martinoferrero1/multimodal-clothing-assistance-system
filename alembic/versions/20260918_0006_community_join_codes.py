"""Add private join codes to community listings.

Revision ID: 20260918_0006
Revises: 20260918_0005
Create Date: 2026-09-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260918_0006"
down_revision: Union[str, None] = "20260918_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("store_community_listings", sa.Column("join_code", sa.String(length=64), nullable=True))
    op.create_index("uq_store_community_listings_join_code", "store_community_listings", ["join_code"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    join_code_count = bind.execute(
        sa.text("SELECT COUNT(*) FROM store_community_listings WHERE join_code IS NOT NULL")
    ).scalar_one()
    subscription_count = bind.execute(sa.text("SELECT COUNT(*) FROM store_community_subscriptions")).scalar_one()
    listing_count = bind.execute(sa.text("SELECT COUNT(*) FROM store_community_listings")).scalar_one()
    inventory_count = bind.execute(sa.text("SELECT COUNT(*) FROM store_inventory_items")).scalar_one()
    store_count = bind.execute(sa.text("SELECT COUNT(*) FROM stores")).scalar_one()
    if join_code_count or subscription_count or listing_count or inventory_count or store_count:
        raise RuntimeError(
            "Community join-code downgrade would discard data or leave a partial commercial downgrade. "
            "Remove commercial data explicitly before downgrading."
        )
    op.drop_index("uq_store_community_listings_join_code", table_name="store_community_listings")
    op.drop_column("store_community_listings", "join_code")

"""Add revocable opaque web sessions.

Revision ID: 20260817_0002
Revises: 20260814_0001
Create Date: 2026-08-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260817_0002"
down_revision: Union[str, None] = "20260814_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("idle_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("absolute_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoke_reason", sa.String(length=32), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["chat_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash", name="uq_auth_sessions_token_hash"),
    )
    op.create_index("ix_auth_sessions_token_hash", "auth_sessions", ["token_hash"], unique=False)
    op.create_index("ix_auth_sessions_user_revoked", "auth_sessions", ["user_id", "revoked_at"], unique=False)
    op.create_index("ix_auth_sessions_expiry", "auth_sessions", ["idle_expires_at", "absolute_expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_auth_sessions_expiry", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_user_revoked", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_token_hash", table_name="auth_sessions")
    op.drop_table("auth_sessions")

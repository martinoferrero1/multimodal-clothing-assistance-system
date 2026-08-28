"""Add commercial store identity persistence.

Revision ID: 20260825_0003
Revises: 20260817_0002
Create Date: 2026-08-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260825_0003"
down_revision: Union[str, None] = "20260817_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The default populates existing rows; the explicit update keeps the backfill
    # deterministic if a dialect does not materialize an added-column default.
    with op.batch_alter_table("chat_users") as batch_op:
        batch_op.add_column(
            sa.Column(
                "account_kind",
                sa.String(length=16),
                server_default=sa.text("'consumer'"),
                nullable=False,
            )
        )
        batch_op.add_column(sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.create_check_constraint(
            "ck_chat_users_account_kind",
            "account_kind IN ('consumer', 'guest')",
        )
    op.execute("UPDATE chat_users SET account_kind = 'consumer' WHERE account_kind IS NULL")

    op.create_table(
        "stores",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("legal_name", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("public_handle", sa.String(length=120), nullable=False),
        sa.Column("jurisdiction", sa.String(length=64), nullable=False),
        sa.Column("business_identifier", sa.String(length=128), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("contact_email", sa.String(length=255), nullable=False),
        sa.Column("contact_phone", sa.String(length=64), nullable=False),
        sa.Column(
            "status",
            sa.String(length=16),
            server_default=sa.text("'pending'"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'active', 'rejected', 'suspended')",
            name="ck_stores_status",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_stores"),
        sa.UniqueConstraint("public_handle", name="uq_stores_public_handle"),
        sa.UniqueConstraint(
            "jurisdiction",
            "business_identifier",
            name="uq_stores_jurisdiction_business_identifier",
        ),
    )
    op.create_index("ix_stores_status", "stores", ["status"], unique=False)

    op.create_table(
        "store_memberships",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("store_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoke_reason", sa.String(length=64), nullable=True),
        sa.CheckConstraint("role = 'owner'", name="ck_store_memberships_role"),
        sa.ForeignKeyConstraint(
            ["store_id"],
            ["stores.id"],
            name="fk_store_memberships_store_id_stores",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["chat_users.id"],
            name="fk_store_memberships_user_id_chat_users",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_store_memberships"),
        sa.UniqueConstraint("store_id", "user_id", name="uq_store_memberships_store_user"),
    )
    op.create_index(
        "uq_store_memberships_active_owner",
        "store_memberships",
        ["store_id"],
        unique=True,
        postgresql_where=sa.text("role = 'owner' AND revoked_at IS NULL"),
        sqlite_where=sa.text("role = 'owner' AND revoked_at IS NULL"),
    )
    op.create_index(
        "ix_store_memberships_store_active",
        "store_memberships",
        ["store_id", "revoked_at"],
        unique=False,
    )
    op.create_index(
        "ix_store_memberships_user_active",
        "store_memberships",
        ["user_id", "revoked_at"],
        unique=False,
    )

    op.create_table(
        "store_verification_tokens",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("store_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "purpose",
            sa.String(length=32),
            server_default=sa.text("'email_verification'"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "purpose = 'email_verification'",
            name="ck_store_verification_tokens_purpose",
        ),
        sa.ForeignKeyConstraint(
            ["store_id"],
            ["stores.id"],
            name="fk_store_verification_tokens_store_id_stores",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["chat_users.id"],
            name="fk_store_verification_tokens_user_id_chat_users",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_store_verification_tokens"),
        sa.UniqueConstraint("token_hash", name="uq_store_verification_tokens_token_hash"),
    )
    op.create_index(
        "ix_store_verification_tokens_store_user_pending",
        "store_verification_tokens",
        ["store_id", "user_id", "consumed_at", "expires_at"],
        unique=False,
    )

    op.create_table(
        "user_mfa_credentials",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("store_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("secret_ciphertext", sa.Text(), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["store_id"],
            ["stores.id"],
            name="fk_user_mfa_credentials_store_id_stores",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["chat_users.id"],
            name="fk_user_mfa_credentials_user_id_chat_users",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_user_mfa_credentials"),
        sa.UniqueConstraint("store_id", "user_id", name="uq_user_mfa_credentials_store_user"),
    )
    op.create_index(
        "ix_user_mfa_credentials_store_user_active",
        "user_mfa_credentials",
        ["store_id", "user_id", "revoked_at"],
        unique=False,
    )

    op.create_table(
        "store_security_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("store_id", sa.String(length=36), nullable=False),
        sa.Column("actor_user_id", sa.String(length=36), nullable=True),
        sa.Column("target_user_id", sa.String(length=36), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("outcome", sa.String(length=32), nullable=False),
        sa.Column("correlation_id", sa.String(length=36), nullable=True),
        sa.Column("event_metadata", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["store_id"],
            ["stores.id"],
            name="fk_store_security_events_store_id_stores",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["chat_users.id"],
            name="fk_store_security_events_actor_user_id_chat_users",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["target_user_id"],
            ["chat_users.id"],
            name="fk_store_security_events_target_user_id_chat_users",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_store_security_events"),
    )
    op.create_index(
        "ix_store_security_events_store_created",
        "store_security_events",
        ["store_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_store_security_events_actor_created",
        "store_security_events",
        ["actor_user_id", "created_at"],
        unique=False,
    )

    with op.batch_alter_table("auth_sessions") as batch_op:
        batch_op.add_column(sa.Column("active_store_id", sa.String(length=36), nullable=True))
        batch_op.create_foreign_key(
            "fk_auth_sessions_active_store_id_stores",
            "stores",
            ["active_store_id"],
            ["id"],
            ondelete="SET NULL",
        )
    op.create_index(
        "ix_auth_sessions_active_store_revoked",
        "auth_sessions",
        ["active_store_id", "revoked_at"],
        unique=False,
    )


def downgrade() -> None:
    bind = op.get_bind()
    commercial_tables = (
        "stores",
        "store_memberships",
        "store_verification_tokens",
        "user_mfa_credentials",
        "store_security_events",
    )
    populated_tables = [
        table_name
        for table_name in commercial_tables
        if bind.scalar(sa.text(f"SELECT COUNT(*) FROM {table_name}"))
    ]
    has_email_verification = bind.scalar(
        sa.text("SELECT EXISTS (SELECT 1 FROM chat_users WHERE email_verified_at IS NOT NULL)")
    )
    has_non_consumer_accounts = bind.scalar(
        sa.text("SELECT EXISTS (SELECT 1 FROM chat_users WHERE account_kind <> 'consumer')")
    )
    if populated_tables or has_email_verification or has_non_consumer_accounts:
        raise RuntimeError(
            "Commercial identity downgrade would discard data; restore a verified pre-migration "
            "backup or apply a reviewed forward migration."
        )

    op.drop_index("ix_auth_sessions_active_store_revoked", table_name="auth_sessions")
    with op.batch_alter_table("auth_sessions") as batch_op:
        batch_op.drop_constraint("fk_auth_sessions_active_store_id_stores", type_="foreignkey")
        batch_op.drop_column("active_store_id")

    op.drop_index("ix_store_security_events_actor_created", table_name="store_security_events")
    op.drop_index("ix_store_security_events_store_created", table_name="store_security_events")
    op.drop_table("store_security_events")

    op.drop_index("ix_user_mfa_credentials_store_user_active", table_name="user_mfa_credentials")
    op.drop_table("user_mfa_credentials")

    op.drop_index(
        "ix_store_verification_tokens_store_user_pending",
        table_name="store_verification_tokens",
    )
    op.drop_table("store_verification_tokens")

    op.drop_index("ix_store_memberships_user_active", table_name="store_memberships")
    op.drop_index("ix_store_memberships_store_active", table_name="store_memberships")
    op.drop_index("uq_store_memberships_active_owner", table_name="store_memberships")
    op.drop_table("store_memberships")

    op.drop_index("ix_stores_status", table_name="stores")
    op.drop_table("stores")

    with op.batch_alter_table("chat_users") as batch_op:
        batch_op.drop_constraint("ck_chat_users_account_kind", type_="check")
        batch_op.drop_column("email_verified_at")
        batch_op.drop_column("account_kind")

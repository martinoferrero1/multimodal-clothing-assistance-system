"""Create the application-owned baseline schema.

Revision ID: 20260814_0001
Revises:
Create Date: 2026-08-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260814_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "brands",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "chat_users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("search_preferences", sa.JSON(), nullable=True),
        sa.Column("style_preferences", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "colors",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "genders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "master_categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "seasons",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "conversations",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("is_pinned", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("sidebar_position", sa.Integer(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("summary_message_count", sa.Integer(), nullable=False),
        sa.Column("search_preferences", sa.JSON(), nullable=True),
        sa.Column("style_preferences", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["chat_users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_conversations_user_id", "conversations", ["user_id"], unique=False)
    op.create_table(
        "sub_categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("master_category_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["master_category_id"], ["master_categories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "article_types",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("sub_category_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["sub_category_id"], ["sub_categories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("conversation_id", sa.String(length=36), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("attachments", sa.JSON(), nullable=True),
        sa.Column("final_response_payload", sa.JSON(), nullable=True),
        sa.Column("workflow_errors", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_messages_conversation_id", "chat_messages", ["conversation_id"], unique=False)
    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_display_name", sa.String(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("usage", sa.String(), nullable=True),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("gender_id", sa.Integer(), nullable=False),
        sa.Column("master_category_id", sa.Integer(), nullable=False),
        sa.Column("sub_category_id", sa.Integer(), nullable=False),
        sa.Column("article_type_id", sa.Integer(), nullable=False),
        sa.Column("brand_id", sa.Integer(), nullable=False),
        sa.Column("season_id", sa.Integer(), nullable=False),
        sa.Column("base_colour_id", sa.Integer(), nullable=False),
        sa.Column("colour1_id", sa.Integer(), nullable=True),
        sa.Column("colour2_id", sa.Integer(), nullable=True),
        sa.Column("image_top", sa.String(), nullable=True),
        sa.Column("image_back", sa.String(), nullable=True),
        sa.Column("image_search", sa.String(), nullable=True),
        sa.Column("image_default", sa.String(), nullable=True),
        sa.Column("image_left", sa.String(), nullable=True),
        sa.Column("image_front", sa.String(), nullable=True),
        sa.Column("image_right", sa.String(), nullable=True),
        sa.CheckConstraint("price > 0", name="check_price_positive"),
        sa.ForeignKeyConstraint(["article_type_id"], ["article_types.id"]),
        sa.ForeignKeyConstraint(["base_colour_id"], ["colors.id"]),
        sa.ForeignKeyConstraint(["brand_id"], ["brands.id"]),
        sa.ForeignKeyConstraint(["colour1_id"], ["colors.id"]),
        sa.ForeignKeyConstraint(["colour2_id"], ["colors.id"]),
        sa.ForeignKeyConstraint(["gender_id"], ["genders.id"]),
        sa.ForeignKeyConstraint(["master_category_id"], ["master_categories.id"]),
        sa.ForeignKeyConstraint(["season_id"], ["seasons.id"]),
        sa.ForeignKeyConstraint(["sub_category_id"], ["sub_categories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "product_embeddings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("embedding_identifier", sa.String(), nullable=False),
        sa.Column("source_text_hash", sa.String(length=64), nullable=False),
        sa.Column("vector_json", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("embedding_identifier", "product_id", name="uq_product_embeddings_identifier_product"),
    )
    op.create_index("ix_product_embeddings_identifier_product", "product_embeddings", ["embedding_identifier", "product_id"], unique=False)
    op.create_table(
        "user_preference_signals",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("conversation_id", sa.String(length=36), nullable=True),
        sa.Column("message_id", sa.String(length=36), nullable=True),
        sa.Column("field", sa.String(length=80), nullable=False),
        sa.Column("value", sa.String(length=255), nullable=False),
        sa.Column("normalized_value", sa.String(length=255), nullable=False),
        sa.Column("polarity", sa.String(length=20), nullable=False),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("strength", sa.Float(), nullable=False),
        sa.Column("evidence", sa.Text(), nullable=True),
        sa.Column("observed_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"]),
        sa.ForeignKeyConstraint(["message_id"], ["chat_messages.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["chat_users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_preference_signals_conversation_id", "user_preference_signals", ["conversation_id"], unique=False)
    op.create_index("ix_user_preference_signals_field", "user_preference_signals", ["field"], unique=False)
    op.create_index("ix_user_preference_signals_message_id", "user_preference_signals", ["message_id"], unique=False)
    op.create_index("ix_user_preference_signals_normalized_value", "user_preference_signals", ["normalized_value"], unique=False)
    op.create_index("ix_user_preference_signals_user_id", "user_preference_signals", ["user_id"], unique=False)
    op.create_table(
        "user_preference_aggregates",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("field", sa.String(length=80), nullable=False),
        sa.Column("value", sa.String(length=255), nullable=False),
        sa.Column("normalized_value", sa.String(length=255), nullable=False),
        sa.Column("polarity", sa.String(length=20), nullable=False),
        sa.Column("observation_count", sa.Integer(), nullable=False),
        sa.Column("weighted_score", sa.Float(), nullable=False),
        sa.Column("recent_score", sa.Float(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("evidence", sa.Text(), nullable=True),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("suppressed", sa.Boolean(), nullable=False),
        sa.Column("suppressed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["chat_users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "field", "normalized_value", "polarity", name="uq_user_preference_aggregate_value"),
    )
    op.create_index("ix_user_preference_aggregates_field", "user_preference_aggregates", ["field"], unique=False)
    op.create_index("ix_user_preference_aggregates_normalized_value", "user_preference_aggregates", ["normalized_value"], unique=False)
    op.create_index("ix_user_preference_aggregates_user_id", "user_preference_aggregates", ["user_id"], unique=False)


def downgrade() -> None:
    raise RuntimeError(
        "The application baseline is forward-only; restore a verified backup or apply a reviewed forward fix."
    )

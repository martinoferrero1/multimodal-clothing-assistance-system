from __future__ import annotations

import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine import Engine

from infra.db.migration_metadata import application_metadata
from infra.db.migration_state import current_database_heads, repository_heads, require_current_revision
from infra.db.schema_comparison import compare_application_schema
from scripts.adopt_legacy_database import adopt_legacy_database


ROOT = Path(__file__).resolve().parents[1]
DATABASE_URL = os.environ.get("POSTGRES_TEST_DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "POSTGRES_TEST_DATABASE_URL is required. Run scripts/verify_postgresql_migrations.sh."
    )


def _config() -> Config:
    config = Config(str(ROOT / "alembic.ini"))
    config.attributes["database_url"] = DATABASE_URL
    return config


def _reset_database() -> None:
    engine = create_engine(DATABASE_URL)
    try:
        with engine.begin() as connection:
            connection.execute(text("DROP SCHEMA public CASCADE"))
            connection.execute(text("CREATE SCHEMA public"))
    finally:
        engine.dispose()


@pytest.fixture(autouse=True)
def disposable_schema():
    _reset_database()
    yield
    _reset_database()


def test_postgresql_blank_upgrade_and_forward_only_downgrade() -> None:
    command.upgrade(_config(), "head")
    command.check(_config())
    engine = create_engine(DATABASE_URL)
    with engine.begin() as connection:
        assert set(inspect(connection).get_table_names()) == set(application_metadata.tables) | {
            "alembic_version"
        }
        assert compare_application_schema(connection).equivalent
        connection.execute(
            text("INSERT INTO chat_users (id, display_name) VALUES ('pg-user', 'PostgreSQL')")
        )
    before_revision = current_database_heads(engine)
    destructive: list[str] = []

    def capture(connection, cursor, statement, parameters, context, executemany):
        if statement.strip().upper().startswith(("DROP ", "ALTER ", "TRUNCATE ")):
            destructive.append(statement)

    event.listen(Engine, "before_cursor_execute", capture)
    try:
        require_current_revision(engine)
        with pytest.raises(RuntimeError, match="forward-only"):
            command.downgrade(_config(), "base")
        assert destructive == []
        assert current_database_heads(engine) == before_revision == repository_heads()
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT count(*) FROM chat_users")) == 1
    finally:
        event.remove(Engine, "before_cursor_execute", capture)
        engine.dispose()


def test_postgresql_legacy_adoption_preserves_rows() -> None:
    engine = create_engine(DATABASE_URL)
    application_metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO chat_users (id, display_name) VALUES ('legacy-pg', 'Legacy')")
        )
        assert compare_application_schema(connection).equivalent
    engine.dispose()

    assert adopt_legacy_database(DATABASE_URL) == repository_heads()[0]
    engine = create_engine(DATABASE_URL)
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM chat_users")) == 1
    engine.dispose()


@pytest.mark.parametrize("drift", ["missing", "extra", "incompatible"])
def test_postgresql_legacy_adoption_rejects_drift(drift: str) -> None:
    engine = create_engine(DATABASE_URL)
    application_metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO chat_users (id, display_name) VALUES ('legacy-pg', 'Legacy')")
        )
        if drift == "missing":
            connection.execute(text("DROP TABLE brands CASCADE"))
        elif drift == "extra":
            connection.execute(text("CREATE TABLE unexpected_table (id INTEGER PRIMARY KEY)"))
        else:
            connection.execute(text("ALTER TABLE chat_users ADD COLUMN unexpected_value TEXT"))
    engine.dispose()
    with pytest.raises(RuntimeError, match="does not match"):
        adopt_legacy_database(DATABASE_URL)

    engine = create_engine(DATABASE_URL)
    try:
        assert current_database_heads(engine) == ()
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT count(*) FROM chat_users")) == 1
    finally:
        engine.dispose()

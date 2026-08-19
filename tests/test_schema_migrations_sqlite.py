from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
import subprocess
import sys

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine import Engine

from infra.db.migration_metadata import application_metadata
from infra.db.migration_state import (
    MigrationRevisionError,
    current_database_heads,
    repository_heads,
    require_current_revision,
)
from infra.db.schema_comparison import compare_application_schema
from scripts.adopt_legacy_database import adopt_legacy_database


ROOT = Path(__file__).resolve().parents[1]


def _url(path: Path) -> str:
    return f"sqlite:///{path.as_posix()}"


def _config(database_url: str) -> Config:
    config = Config(str(ROOT / "alembic.ini"))
    config.attributes["database_url"] = database_url
    return config


def _upgrade(database_url: str) -> None:
    command.upgrade(_config(database_url), "head")


def _create_legacy(database_url: str) -> None:
    engine = create_engine(database_url)
    try:
        application_metadata.create_all(engine)
    finally:
        engine.dispose()


def _assert_gate_rejected_read_only(engine, **kwargs) -> None:
    statements: list[str] = []

    def capture(connection, cursor, statement, parameters, context, executemany):
        statements.append(statement.strip().upper())

    event.listen(engine, "before_cursor_execute", capture)
    try:
        with pytest.raises(MigrationRevisionError) as exc_info:
            require_current_revision(engine, **kwargs)
        assert "alembic upgrade head" in str(exc_info.value)
        assert "verify-then-stamp" in str(exc_info.value)
        assert not any(
            statement.startswith(("CREATE ", "ALTER ", "DROP ", "INSERT ", "UPDATE ", "DELETE "))
            for statement in statements
        )
    finally:
        event.remove(engine, "before_cursor_execute", capture)


def test_migration_metadata_import_does_not_load_application_settings(tmp_path: Path) -> None:
    environment = os.environ.copy()
    environment["PYTHONPATH"] = str(ROOT / "src")
    for name in ("APP_ENV", "SESSION_CSRF_SECRET", "GOOGLE_API_KEY", "GROQ_API_KEY"):
        environment.pop(name, None)
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import sys; import infra.db.migration_metadata; "
            "assert 'core.settings' not in sys.modules",
        ],
        cwd=tmp_path,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr


def test_blank_upgrade_matches_metadata_and_head(tmp_path: Path) -> None:
    database_url = _url(tmp_path / "blank.sqlite")
    _upgrade(database_url)
    command.check(_config(database_url))
    engine = create_engine(database_url)
    try:
        expected_tables = set(application_metadata.tables) | {"alembic_version"}
        assert set(inspect(engine).get_table_names()) == expected_tables
        with engine.connect() as connection:
            assert compare_application_schema(connection).equivalent
        assert current_database_heads(engine) == repository_heads()
        require_current_revision(engine)
    finally:
        engine.dispose()


def test_session_downgrade_preserves_non_session_data_and_reupgrades(tmp_path: Path) -> None:
    database_url = _url(tmp_path / "downgrade.sqlite")
    _upgrade(database_url)
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO chat_users (id, display_name) "
                "VALUES ('representative-user', 'Representative')"
            )
        )
    try:
        command.downgrade(_config(database_url), "20260814_0001")
        assert "auth_sessions" not in set(inspect(engine).get_table_names())
        assert current_database_heads(engine) == ("20260814_0001",)
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT count(*) FROM chat_users")) == 1
        command.upgrade(_config(database_url), "head")
        assert "auth_sessions" in set(inspect(engine).get_table_names())
        assert current_database_heads(engine) == repository_heads()
    finally:
        engine.dispose()


def test_equivalent_legacy_schema_is_stamped_without_changing_rows(tmp_path: Path) -> None:
    database_url = _url(tmp_path / "legacy.sqlite")
    _create_legacy(database_url)
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO chat_users (id, display_name) VALUES ('legacy-user', 'Legacy')")
        )
        assert compare_application_schema(connection).equivalent
    engine.dispose()

    assert adopt_legacy_database(database_url) == repository_heads()[0]

    engine = create_engine(database_url)
    try:
        assert current_database_heads(engine) == repository_heads()
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT count(*) FROM chat_users")) == 1
    finally:
        engine.dispose()


@pytest.mark.parametrize("drift", ["missing", "extra", "incompatible"])
def test_legacy_adoption_refuses_structural_drift(tmp_path: Path, drift: str) -> None:
    database_url = _url(tmp_path / f"legacy-{drift}.sqlite")
    _create_legacy(database_url)
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO chat_users (id, display_name) VALUES ('legacy-user', 'Legacy')")
        )
        if drift == "missing":
            connection.execute(text("DROP TABLE brands"))
        elif drift == "extra":
            connection.execute(text("CREATE TABLE unexpected_table (id INTEGER PRIMARY KEY)"))
        else:
            connection.execute(text("ALTER TABLE chat_users ADD COLUMN unexpected_value TEXT"))
    engine.dispose()

    with pytest.raises(RuntimeError, match="does not match"):
        adopt_legacy_database(database_url)

    engine = create_engine(database_url)
    try:
        assert current_database_heads(engine) == ()
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT count(*) FROM chat_users")) == 1
    finally:
        engine.dispose()


def test_revision_gate_rejects_blank_unversioned_behind_and_divergent(tmp_path: Path) -> None:
    blank = create_engine(_url(tmp_path / "blank-gate.sqlite"))
    _assert_gate_rejected_read_only(blank)
    blank.dispose()

    legacy_url = _url(tmp_path / "legacy-gate.sqlite")
    _create_legacy(legacy_url)
    legacy = create_engine(legacy_url)
    _assert_gate_rejected_read_only(legacy)
    legacy.dispose()

    current_url = _url(tmp_path / "behind-gate.sqlite")
    _upgrade(current_url)
    current = create_engine(current_url)
    _assert_gate_rejected_read_only(current, expected_heads=("future_revision",))
    current.dispose()

    divergent_url = _url(tmp_path / "divergent-gate.sqlite")
    divergent = create_engine(divergent_url)
    with divergent.begin() as connection:
        connection.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        connection.execute(text("INSERT INTO alembic_version VALUES ('unknown_revision')"))
    _assert_gate_rejected_read_only(divergent)
    divergent.dispose()


def test_concurrent_revision_gates_are_read_only(tmp_path: Path) -> None:
    database_url = _url(tmp_path / "concurrent.sqlite")
    _upgrade(database_url)
    engine = create_engine(database_url)
    statements: list[str] = []

    @event.listens_for(engine, "before_cursor_execute")
    def capture_statements(connection, cursor, statement, parameters, context, executemany):
        statements.append(statement.strip().upper())

    try:
        with ThreadPoolExecutor(max_workers=8) as executor:
            list(executor.map(lambda _: require_current_revision(engine), range(16)))
        assert statements
        assert not any(
            statement.startswith(("CREATE ", "ALTER ", "DROP ", "INSERT ", "UPDATE ", "DELETE "))
            for statement in statements
        )
    finally:
        engine.dispose()

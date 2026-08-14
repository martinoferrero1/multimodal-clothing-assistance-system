from __future__ import annotations

import asyncio
import importlib
import os
import sys
import types
from pathlib import Path

os.environ["APP_ENV"] = "test"
os.environ["AUTH_TOKEN_SECRET"] = "test-only-auth-secret"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.engine import Engine

from core.metaclasses.singleton_meta import SingletonMeta
from infra.db.database import Database
from infra.db.migration_state import MigrationRevisionError, require_current_revision
from scripts.seed_db import seed_catalog


ROOT = Path(__file__).resolve().parents[1]


def _upgrade(database_url: str) -> None:
    config = Config(str(ROOT / "alembic.ini"))
    config.attributes["database_url"] = database_url
    command.upgrade(config, "head")


@pytest.fixture(autouse=True)
def clear_database_singleton():
    SingletonMeta._instances.pop(Database, None)
    yield
    instance = SingletonMeta._instances.pop(Database, None)
    if instance is not None:
        instance.engine.dispose()


@pytest.fixture
def app_module(monkeypatch):
    runtime_module = types.ModuleType("services.conversation_runtime_service")

    class StubConversationRuntimeService:
        def __init__(self, checkpointer):
            self.checkpointer = checkpointer

    runtime_module.ConversationRuntimeService = StubConversationRuntimeService
    monkeypatch.setitem(sys.modules, "services.conversation_runtime_service", runtime_module)
    sys.modules.pop("api.app", None)
    module = importlib.import_module("api.app")
    yield module
    sys.modules.pop("api.app", None)


def test_database_initialization_emits_no_ddl(tmp_path: Path) -> None:
    database_url = f"sqlite:///{(tmp_path / 'database.sqlite').as_posix()}"
    _upgrade(database_url)
    statements: list[str] = []

    def capture(connection, cursor, statement, parameters, context, executemany):
        statements.append(statement.strip().upper())

    event.listen(Engine, "before_cursor_execute", capture)
    database = Database(database_url)
    try:
        require_current_revision(database.engine)
        assert statements
        assert not any(
            statement.startswith(("CREATE ", "ALTER ", "DROP ", "INSERT ", "UPDATE ", "DELETE "))
            for statement in statements
        )
    finally:
        event.remove(Engine, "before_cursor_execute", capture)
        database.engine.dispose()


def test_catalog_seed_refuses_unmigrated_database_before_csv_access(
    tmp_path: Path, monkeypatch
) -> None:
    database_url = f"sqlite:///{(tmp_path / 'unmigrated.sqlite').as_posix()}"
    database = Database(database_url)
    monkeypatch.setattr("scripts.seed_db.CSV_PATH", tmp_path / "missing.csv")
    try:
        with pytest.raises(MigrationRevisionError):
            seed_catalog(database)
    finally:
        database.engine.dispose()


def test_lifespan_orders_readiness_before_revision_seed_and_runtime(monkeypatch, app_module) -> None:
    calls: list[str] = []

    class FakeDatabase:
        engine = object()

        async def dispose(self):
            calls.append("dispose")

    class FakeCheckpointer:
        checkpointer = object()

        def start(self):
            calls.append("checkpoint-start")

        def close(self):
            calls.append("checkpoint-close")

    class FakeRuntime:
        def __init__(self, checkpointer):
            calls.append("runtime")

    def gate(engine):
        calls.append("revision-gate")

    def seed(database):
        calls.append("seed")

    async def readiness(app):
        calls.append("provider-readiness")

    monkeypatch.setattr(app_module, "Database", FakeDatabase)
    monkeypatch.setattr(app_module, "require_current_revision", gate)
    monkeypatch.setattr(app_module, "seed_catalog", seed)
    monkeypatch.setattr(app_module, "run_provider_readiness_gate", readiness)
    monkeypatch.setattr(app_module, "LangGraphCheckpointer", FakeCheckpointer)
    monkeypatch.setattr(app_module, "ConversationRuntimeService", FakeRuntime)

    async def exercise_lifespan():
        async with app_module.lifespan(app_module.app):
            calls.append("serving")

    asyncio.run(exercise_lifespan())

    assert calls == [
        "provider-readiness",
        "revision-gate",
        "seed",
        "checkpoint-start",
        "runtime",
        "serving",
        "checkpoint-close",
        "dispose",
    ]


def test_invalid_revision_stops_before_seed_and_runtime(monkeypatch, app_module) -> None:
    calls: list[str] = []

    class FakeDatabase:
        engine = object()

        async def dispose(self):
            calls.append("dispose")

    def reject(engine):
        calls.append("revision-gate")
        raise MigrationRevisionError("not current")

    monkeypatch.setattr(app_module, "Database", FakeDatabase)
    monkeypatch.setattr(app_module, "require_current_revision", reject)
    monkeypatch.setattr(app_module, "seed_catalog", lambda database: calls.append("seed"))
    monkeypatch.setattr(app_module, "run_provider_readiness_gate", lambda app: _async_call(calls, "provider-readiness"))

    async def exercise_lifespan():
        async with app_module.lifespan(app_module.app):
            pass

    with pytest.raises(MigrationRevisionError):
        asyncio.run(exercise_lifespan())

    assert calls == ["provider-readiness", "revision-gate", "dispose"]


async def _async_call(calls: list[str], value: str) -> None:
    calls.append(value)


def test_provider_readiness_failure_stops_before_database_initialization(
    monkeypatch, app_module
) -> None:
    calls: list[str] = []

    async def reject_readiness(app):
        calls.append("provider-readiness")
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(app_module, "run_provider_readiness_gate", reject_readiness)
    monkeypatch.setattr(
        app_module,
        "Database",
        lambda: pytest.fail("database must not initialize before provider readiness"),
    )

    async def exercise_lifespan():
        async with app_module.lifespan(app_module.app):
            pass

    with pytest.raises(RuntimeError, match="provider unavailable"):
        asyncio.run(exercise_lifespan())

    assert calls == ["provider-readiness"]


def test_api_health_starts_at_head_without_emitting_ddl(
    tmp_path: Path, monkeypatch, app_module
) -> None:
    database_url = f"sqlite:///{(tmp_path / 'api.sqlite').as_posix()}"
    _upgrade(database_url)
    database = Database(database_url)
    statements: list[str] = []

    class FakeCheckpointer:
        checkpointer = object()

        def start(self):
            pass

        def close(self):
            pass

    monkeypatch.setattr(app_module, "Database", lambda: database)
    monkeypatch.setattr(app_module, "seed_catalog", lambda database: None)
    monkeypatch.setattr(app_module, "LangGraphCheckpointer", FakeCheckpointer)

    @event.listens_for(database.engine, "before_cursor_execute")
    def capture_statements(connection, cursor, statement, parameters, context, executemany):
        statements.append(statement.strip().upper())

    try:
        with TestClient(app_module.app) as client:
            assert client.get("/health").status_code == 200
        assert statements
        assert not any(
            statement.startswith(("CREATE ", "ALTER ", "DROP ", "INSERT ", "UPDATE ", "DELETE "))
            for statement in statements
        )
    finally:
        event.remove(database.engine, "before_cursor_execute", capture_statements)

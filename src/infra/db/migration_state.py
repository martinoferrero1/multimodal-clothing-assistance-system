from __future__ import annotations

from pathlib import Path

from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Engine


class MigrationRevisionError(RuntimeError):
    pass


def repository_heads() -> tuple[str, ...]:
    root = Path(__file__).resolve().parents[3]
    config = Config(str(root / "alembic.ini"))
    return tuple(sorted(ScriptDirectory.from_config(config).get_heads()))


def current_database_heads(engine: Engine) -> tuple[str, ...]:
    with engine.connect() as connection:
        return tuple(sorted(MigrationContext.configure(connection).get_current_heads()))


def require_current_revision(
    engine: Engine,
    *,
    expected_heads: tuple[str, ...] | None = None,
) -> None:
    expected = tuple(sorted(expected_heads or repository_heads()))
    current = current_database_heads(engine)
    if current != expected:
        raise MigrationRevisionError(
            "Database revision is not current. Run 'alembic upgrade head' for a blank/versioned "
            "database or the documented verify-then-stamp adoption command for a legacy database."
        )

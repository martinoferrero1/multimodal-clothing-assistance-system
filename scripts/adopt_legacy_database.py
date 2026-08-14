from __future__ import annotations

import sys
from pathlib import Path

from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, func, select

from infra.db.migration_metadata import application_metadata
from infra.db.migration_url import resolve_migration_database_url
from infra.db.schema_comparison import compare_application_schema


def adopt_legacy_database(database_url: str | None = None) -> str:
    url = resolve_migration_database_url(configured_url=database_url)
    root = Path(__file__).resolve().parents[1]
    script = ScriptDirectory.from_config(Config(str(root / "alembic.ini")))
    heads = script.get_heads()
    if len(heads) != 1:
        raise RuntimeError("Legacy adoption requires exactly one repository head.")

    engine = create_engine(url)
    try:
        with engine.begin() as connection:
            migration_context = MigrationContext.configure(connection)
            if migration_context.get_current_heads():
                raise RuntimeError("Legacy adoption requires an unversioned database.")

            comparison = compare_application_schema(connection)
            if not comparison.equivalent:
                details = "\n".join(f"- {item}" for item in comparison.differences)
                raise RuntimeError(f"Legacy schema does not match the baseline:\n{details}")

            row_counts = {
                name: connection.scalar(select(func.count()).select_from(table))
                for name, table in application_metadata.tables.items()
            }
            migration_context.stamp(script, heads[0])
            stamped_heads = MigrationContext.configure(connection).get_current_heads()
            if tuple(stamped_heads) != (heads[0],):
                raise RuntimeError("Legacy adoption could not verify the recorded revision.")
            if row_counts != {
                name: connection.scalar(select(func.count()).select_from(table))
                for name, table in application_metadata.tables.items()
            }:
                raise RuntimeError("Legacy adoption detected an unexpected row-count change.")
        return heads[0]
    finally:
        engine.dispose()


def main() -> int:
    try:
        revision = adopt_legacy_database()
    except Exception as exc:
        print(f"Adoption refused: {exc}", file=sys.stderr)
        return 1
    print(f"Legacy schema adopted at revision {revision}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

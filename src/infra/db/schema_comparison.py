from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import Connection, inspect

from infra.db.migration_metadata import application_metadata


EXCLUDED_TABLES = frozenset(
    {
        "alembic_version",
        "checkpoint_blobs",
        "checkpoint_migrations",
        "checkpoint_writes",
        "checkpoints",
    }
)


@dataclass(frozen=True)
class SchemaComparison:
    differences: tuple[str, ...]

    @property
    def equivalent(self) -> bool:
        return not self.differences


def compare_application_schema(connection: Connection) -> SchemaComparison:
    """Compare application-owned schema without creating, repairing, or stamping it."""

    def include_object(obj, name, type_, reflected, compare_to):
        if type_ == "table" and name in EXCLUDED_TABLES:
            return False
        if type_ in {"index", "unique_constraint", "foreign_key_constraint"}:
            table = getattr(obj, "table", None)
            if table is not None and table.name in EXCLUDED_TABLES:
                return False
        return True

    context = MigrationContext.configure(
        connection,
        opts={
            "compare_type": True,
            "compare_server_default": True,
            "include_object": include_object,
        },
    )
    raw_differences = compare_metadata(context, application_metadata)
    differences = [repr(difference) for difference in raw_differences]
    differences.extend(_compare_checks_and_primary_keys(connection))
    return SchemaComparison(tuple(sorted(set(differences))))


def _compare_checks_and_primary_keys(connection: Connection) -> Iterable[str]:
    inspector = inspect(connection)
    existing_tables = set(inspector.get_table_names()) - EXCLUDED_TABLES
    expected_tables = set(application_metadata.tables)
    for table_name in sorted(existing_tables & expected_tables):
        table = application_metadata.tables[table_name]
        expected_pk = tuple(column.name for column in table.primary_key.columns)
        actual_pk = tuple(inspector.get_pk_constraint(table_name).get("constrained_columns") or ())
        if actual_pk != expected_pk:
            yield f"primary key mismatch on {table_name}: expected {expected_pk}, found {actual_pk}"

        expected_checks = {
            _normalize_sql(str(constraint.sqltext))
            for constraint in table.constraints
            if constraint.__class__.__name__ == "CheckConstraint"
        }
        actual_checks = {
            _normalize_sql(check["sqltext"])
            for check in inspector.get_check_constraints(table_name)
            if check.get("sqltext")
        }
        if actual_checks != expected_checks:
            yield (
                f"check constraint mismatch on {table_name}: "
                f"expected {sorted(expected_checks)}, found {sorted(actual_checks)}"
            )


def _normalize_sql(value: str) -> str:
    normalized = value.strip().lower().replace('"', "").replace("`", "")
    normalized = re.sub(r"::[a-z_]+(?:\s+[a-z_]+)?(?:\[\])?", "", normalized)
    # PostgreSQL reflects CHECK ... IN (...) as = ANY (ARRAY[...]).
    normalized = re.sub(
        r"([a-z_][a-z0-9_]*)\s*=\s*any\s*\(array\s*\[([^\]]+)\]\)",
        r"\1 in (\2)",
        normalized,
    )
    normalized = re.sub(r"\s+", " ", normalized)
    normalized = re.sub(r"\s*,\s*", ",", normalized)
    while normalized.startswith("(") and normalized.endswith(")"):
        normalized = normalized[1:-1].strip()
    return normalized

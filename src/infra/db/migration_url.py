from __future__ import annotations

import os


def resolve_migration_database_url(*, configured_url: str | None = None) -> str:
    """Resolve only the URL needed by migration tooling, without application settings."""
    database_url = configured_url or os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL must be set explicitly for migration and adoption commands."
        )
    return database_url

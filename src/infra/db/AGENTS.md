# Database and migration instructions

## Schema authority

- Represent every new schema change in a versioned Alembic revision. Do not add runtime `CREATE TABLE` or `ALTER TABLE` operations.
- Keep SQLAlchemy models, constraints, indexes, and migrations synchronized.
- Treat PostgreSQL as the staging/production target and preserve SQLite support for local/test until an approved decision removes it.

## Safe evolution

- Validate both a blank-database upgrade and an upgrade from the previously deployed revision.
- Preserve existing data by default. Require explicit user authorization before destructive cleanup, irreversible transformations, or dropping compatibility.
- Prefer expand-and-contract for changes that may overlap application versions.
- Make data backfills deterministic, restartable, and independent from external APIs or LLM providers.
- Name constraints and indexes explicitly, and review nullability, uniqueness, foreign keys, cascades, defaults, and lock impact.
- Provide a safe downgrade or document why the revision is forward-only together with its restore or forward-recovery procedure.

## Verification

- Test migrations on disposable databases; never use an ambiguous or production database URL.
- After upgrading, verify schema objects, preserved row counts, model compatibility, and that API startup performs no DDL.

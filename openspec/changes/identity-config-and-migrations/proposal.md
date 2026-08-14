## Why

Lookeate currently permits insecure development defaults in every environment and mutates the database schema during normal API startup. Before identity work can safely reach staging or production, configuration must fail closed by environment and Alembic must become the single schema authority.

## What Changes

- Introduce an explicit `APP_ENV` contract for `local`, `test`, `staging`, and `production`, with environment-specific validation and safe development defaults limited to local and test.
- Make staging and production reject SQLite, missing, short, placeholder, or known authentication secrets, missing public URL/host/origin settings, unavailable required providers, and other unsafe runtime configuration in this scope.
- Add a complete, non-secret `.env.example` that documents which values are required or permitted by environment and enables tests without real LLM provider credentials.
- Add Alembic configuration and a versioned baseline representing the current SQLAlchemy schema for both blank databases and databases created by the existing startup-DDL behavior.
- **BREAKING** Remove `Base.metadata.create_all` and `_ensure_chat_schema` schema mutation from normal API/database startup; deployments and local setup must run `alembic upgrade head` explicitly.
- Add migration and configuration verification for blank and existing SQLite/PostgreSQL databases, schema/data preservation, invalid production settings, required-provider readiness during staging/production startup, and startup without DDL. PostgreSQL verification uses a reproducible ephemeral database and fails rather than silently skipping when it cannot run; the forward-only baseline downgrade aborts before destructive DDL.
- Keep sessions, cookies, CSRF, guest identity, and guest promotion unchanged and outside this change.

## Capabilities

### New Capabilities

- `environment-configuration`: Defines Lookeate's environment modes, fail-closed configuration validation, documented environment-variable contract, and test isolation from external provider secrets.
- `schema-migrations`: Defines Alembic as the schema authority, explicit migration execution, compatibility with blank and existing databases, data preservation, and DDL-free application startup.

### Modified Capabilities

None.

## Impact

- Affects settings loading and validation in `src/core/settings.py`, database initialization in `src/infra/db/database.py`, API startup behavior, tests, Docker Compose environment values, and developer setup documentation.
- Adds Alembic configuration, migration revisions, a migration dependency, and `.env.example`.
- Changes the operational contract: schema upgrades become an explicit, single-owner release/setup step before API processes start.
- Does not change authentication APIs, authorization behavior, frontend session handling, CSRF controls, or guest behavior.

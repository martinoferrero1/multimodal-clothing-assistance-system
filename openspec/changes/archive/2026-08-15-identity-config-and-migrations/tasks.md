## 1. Environment Settings Foundation

- [x] 1.1 Add focused settings tests for the full `APP_ENV` matrix, including missing/unknown environments, SQLite restrictions, deployed HTTPS URL and non-wildcard host/origin requirements, missing, shorter-than-32-character, placeholder, and known auth secrets, and non-sensitive validation errors.
- [x] 1.2 Refactor settings construction so `APP_ENV` is required, local/test allowances are explicit, staging/production reject missing, short, placeholder, and known secrets and otherwise fail closed, secret values are protected, and test instances can disable `.env` loading.
- [x] 1.3 Keep provider readiness at the provider initialization boundary for local/test paths, and add a staging/production startup gate that derives every provider required by active configuration and validates its model, credentials, initialization, and bounded availability before serving requests.
- [x] 1.4 Add provider-readiness and test-isolation tests proving unrelated test settings load without real LLM, embedding, or image-analysis credentials; provider use still rejects incomplete configuration; and staging/production startup fails without exposing secrets when a required provider is misconfigured, cannot initialize, times out, or is unavailable.

## 2. Environment Contract and Local Setup

- [x] 2.1 Create a complete root `.env.example` grouped and annotated by environment, with no usable secrets and with every new fail-closed setting documented.
- [x] 2.2 Update local Docker Compose to declare `APP_ENV=local`, provide the public URL/host/origin contract, and require an explicit auth secret instead of falling back to the known development value.
- [x] 2.3 Update local/test setup documentation and test bootstrap configuration so commands declare `APP_ENV`, tests do not depend on the developer's `.env`, and no real provider credentials are required for unrelated suites.

## 3. Alembic Baseline

- [x] 3.1 Add the Alembic dependency and repository configuration with a migration-only database URL resolver that loads no application singleton, provider, seed, or external service and never prints credentials.
- [x] 3.2 Configure migration metadata imports for all application-owned catalog, conversation, and preference models while excluding LangGraph-owned checkpoint schema.
- [x] 3.3 Create and review the initial baseline revision for all current application tables, columns, foreign keys, uniqueness, named constraints/indexes, nullability, and server defaults on SQLite and PostgreSQL, with a forward-only downgrade guard that raises before any destructive Alembic operation.
- [x] 3.4 Add one repository-owned PostgreSQL verification command backed by a dedicated Docker Compose file or profile and version-pinned image, with isolated resources, a health check, guaranteed cleanup, and blank SQLite/PostgreSQL upgrade tests asserting revision, schema/model parity, constraints, indexes, defaults, and nullability.
- [x] 3.5 Document why `downgrade base` is unsafe and the required backup/restore or forward-recovery procedure, and add an instrumented downgrade test proving the baseline aborts before destructive DDL while schema, representative data, and revision remain unchanged.

## 4. Existing Database Adoption

- [x] 4.1 Implement a migration-only legacy-schema comparison that checks unversioned application-owned objects structurally, handles supported dialect differences, excludes external/internal objects, and performs no writes.
- [x] 4.2 Implement the explicit verify-then-stamp adoption command so only an equivalent unversioned schema can receive the baseline revision and any mismatch exits without schema or data changes.
- [x] 4.3 Add SQLite adoption tests with representative legacy rows for successful stamping, preserved row counts, and rejection of missing, extra, or incompatible required schema objects.
- [x] 4.4 Run equivalent PostgreSQL adoption tests through the required ephemeral PostgreSQL command, covering structural parity, revision stamping, preserved data, drift rejection, and resource cleanup.

## 5. DDL-Free Application Startup

- [x] 5.1 Add a read-only migration revision gate that accepts the repository head and rejects blank, unversioned, behind, or divergent databases with a non-sensitive migration/adoption instruction.
- [x] 5.2 Remove `Base.metadata.create_all`, `_ensure_chat_schema`, and all runtime schema mutation from `Database` initialization.
- [x] 5.3 Run the revision gate before catalog seeding and checkpointer startup, and update seed/setup paths to require a migrated database rather than creating schema implicitly.
- [x] 5.4 Add startup tests proving a migrated database starts successfully, invalid revision states fail before DML/runtime initialization, and normal API/database startup emits no DDL or Alembic stamp/upgrade operations.
- [x] 5.5 Add a concurrent-worker startup test or equivalent instrumentation proving multiple API initializations only read migration state and do not contend for schema mutation.

## 6. Operational Verification and Handoff

- [x] 6.1 Document blank-database setup, legacy verify-then-stamp adoption, single-owner release migration order, pre-migration backup/row-count evidence, application-first rollback, and drift recovery.
- [x] 6.2 Run focused settings, provider, migration, adoption, and startup tests for SQLite and through the reproducible ephemeral PostgreSQL command; make provisioning, health, or connection failures exit nonzero and ensure no mandatory PostgreSQL case uses a conditional or silent skip.
- [x] 6.3 Run `PYTHONPATH=src python -m pytest tests/` with isolated test configuration and no real provider credentials, then resolve regressions introduced by this change.
- [x] 6.4 Run `alembic check`, blank and legacy-to-head migration smoke checks, the guarded baseline downgrade check, API startup against head, and OpenSpec strict validation; confirm metadata alignment, preserved rows and revision after the refused downgrade, zero startup DDL, and ephemeral PostgreSQL cleanup.

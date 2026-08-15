## Context

See `proposal.md` for motivation and the two capability specs for behavioral contracts. Today `Settings` is instantiated at import time from `.env`, provider validation requires real model credentials even for unrelated tests, `AUTH_TOKEN_SECRET` has a known fallback, and there is no environment identity. `Database.__init__` executes `Base.metadata.create_all` plus ad hoc `ALTER TABLE` statements, while API lifespan immediately seeds catalog data.

The current SQLAlchemy metadata covers catalog, conversation, and preference tables. PostgreSQL is the staging/production target; SQLite remains supported for local and unit-test workflows. LangGraph checkpoint storage is managed by its own integration and is not application-owned Alembic metadata.

## Goals / Non-Goals

**Goals:**

- Make environment policy deterministic, testable, and fail-closed before runtime dependencies initialize.
- Keep migration commands independent from LLM providers, application singletons, and real provider credentials.
- Establish a reviewed Alembic baseline that exactly represents current application-owned metadata.
- Support safe initialization of blank databases and explicit, data-preserving adoption of compatible legacy databases.
- Detect missing or stale migrations without writing schema during API startup.
- Define release, rollback, and verification evidence for SQLite and PostgreSQL.

**Non-Goals:**

- Session storage, cookie flags, CSRF, guest identities, guest promotion, or changes to current auth endpoints.
- New identity tables or changes to the current application data model.
- Selecting hosting, secret-management, observability, email, or CI vendors.
- Production Compose topology, container hardening, health-endpoint redesign, or a complete CI/CD implementation.
- Dependency lockfile work beyond adding the Alembic runtime dependency.

## Decisions

### 1. Use one typed settings model with explicit environment policy

Add a required `APP_ENV` literal and keep one settings model whose post-validation applies policy according to the selected environment. Tests instantiate the model with controlled values and with `.env` loading disabled, rather than mutating the module-level singleton or reading the developer's `.env`.

The contract is:

| Setting | local | test | staging | production |
|---|---|---|---|---|
| `APP_ENV` | required | required | required | required |
| Application DB | SQLite or PostgreSQL | SQLite or PostgreSQL | PostgreSQL only | PostgreSQL only |
| Auth secret | explicit local value | explicit fixture value | at least 32 characters; not a placeholder or known value | at least 32 characters; not a placeholder or known value |
| Public URL | optional documented local default | optional test value | required HTTPS URL | required HTTPS URL |
| Allowed hosts/origins | optional loopback defaults | explicit test values when needed | required, non-wildcard | required, non-wildcard |
| Provider credentials | validated when provider functionality is initialized | not required for unrelated tests | required providers validated for configuration and availability during startup | required providers validated for configuration and availability during startup |

Secret values use secret-aware Pydantic types where practical and validation errors name settings, never values. Staging/production reject the known development secret, placeholders, empty values, wildcard host/origin entries, non-HTTPS public origins, and SQLite URLs. URL/host/origin fields are established here as configuration contracts; enforcement middleware and cookie behavior remain separate work.

Alternative considered: separate settings classes or files per environment. Rejected because it duplicates the large provider/search settings surface and makes drift likely. A discriminated policy in one model is easier to exercise as a matrix.

Alternative considered: default missing `APP_ENV` to `local`. Rejected because a hidden local fallback could carry development allowances into a misconfigured deployment.

### 2. Separate settings construction from provider readiness while gating deployed startup

Environment and core settings validate when `Settings` is constructed. In local and test, provider model/key pairs are validated at provider creation or through an explicit provider-readiness method called only by paths that need them. In staging and production, application startup derives the required provider set from the active provider selections and enabled functionality, then requires every member of that set to pass model/key validation, initialization, and a bounded, non-mutating provider-specific availability check before the API serves requests. A timeout, rejected credential, initialization error, or unavailable required endpoint fails startup with the provider name but no secret value.

The existing module singleton can remain as the application entry point, but tests target the class/factory and disable `.env` loading. Importing Alembic metadata must not import that singleton or execute readiness checks. This keeps migration commands and unrelated tests independent from provider credentials and network access while ensuring deployed instances do not accept traffic in a partially usable state.

Alternative considered: populate fake provider keys globally in the test process. Rejected because it conceals accidental provider initialization and still couples tests to developer environment loading.

### 3. Make `.env.example` a contract, not a runnable secret bundle

Create a root `.env.example` grouped by core runtime, HTTP identity, providers, and optional feature tuning. It documents permitted environments and marks staging/production requirements. Secret fields contain empty values or unmistakable placeholders, never working credentials. Local Compose sets `APP_ENV=local` and stops supplying a known fallback for `AUTH_TOKEN_SECRET`; interpolation requires the operator to provide it.

Developer documentation adds explicit setup commands: create local configuration, run `alembic upgrade head`, optionally seed, then start the API. It also documents that staging and production inject values through their deployment secret/configuration mechanism without selecting a vendor.

Alternative considered: provide separate committed `.env` files per environment. Rejected because they are easy to mistake for deployable configuration and encourage secret duplication.

### 4. Use Alembic with an application-owned baseline

Add Alembic to `requirements.txt`, create `alembic.ini` and an `alembic/` environment, and import all application model modules into `target_metadata`. The migration environment resolves only the database URL through a small migration-specific path; it does not construct full application settings, initialize providers, seed data, or contact external services. Password-bearing URLs are never logged.

The initial revision creates the complete current application-owned schema, including explicit current indexes, foreign keys, uniqueness, nullability, and server defaults. It does not include LangGraph-owned checkpoint tables. The revision is reviewed on both PostgreSQL and SQLite rather than accepted solely because autogeneration succeeds. Existing named constraints remain stable; dialect-generated names in the legacy schema are compared structurally. Future schema changes must use explicit stable names.

Because the baseline is forward-only for adopted databases, its downgrade entry point raises a deliberate migration error before calling any Alembic operation that could emit destructive DDL. An instrumented disposable-database test attempts `downgrade base` and verifies that no `DROP`, `ALTER`, or equivalent destructive statement is issued and that schema, representative rows, and the recorded revision remain unchanged.

Alternative considered: retain `create_all` for blank local databases and use Alembic only in deployed environments. Rejected because two schema authorities drift and local/test no longer exercise the release path.

Alternative considered: make the baseline conditionally skip objects that already exist. Rejected because idempotent-looking DDL can silently bless drift and makes revision outcomes depend on preexisting state.

### 5. Adopt legacy databases by verify-then-stamp

An unversioned database produced by the current application already represents the target baseline, so replaying baseline creation would fail. Provide an explicit adoption command and documentation that:

1. Requires an operator-selected `DATABASE_URL` and confirms the database has no Alembic revision.
2. Compares the application-owned schema to baseline metadata without changing it, excluding dialect-internal and LangGraph-owned objects.
3. Reports structural differences and exits without stamping on any mismatch.
4. Records the baseline revision only after equivalence succeeds.
5. Rechecks current revision and preserves representative table row counts.

The adoption tool uses Alembic/SQLAlchemy comparison APIs and shares metadata imports with the migration environment. It does not repair drift automatically. A drifted database requires backup plus an individually reviewed corrective migration or manual recovery plan.

Alternative considered: tell operators to run `alembic stamp` directly. Rejected because stamping an unknown schema would make later migrations operate on false assumptions.

### 6. Replace startup DDL with a read-only revision gate

Remove `Base.metadata.create_all`, `_ensure_chat_schema`, and their inspection/DDL imports from `Database`. Before catalog seeding or checkpointer startup, API lifespan performs a read-only migration-state check: the version table must exist and its current head set must equal the repository head set. Blank, unversioned, behind, or divergent databases fail with a concise instruction to run or adopt migrations. The check issues metadata/version queries only and never stamps or upgrades.

Test helpers may still call `Base.metadata.create_all` only for isolated unit tests whose purpose is not migration behavior. Integration and migration tests use Alembic. This distinction prevents normal runtime DDL without forcing every focused unit fixture through a subprocess.

Alternative considered: let API startup automatically run `alembic upgrade head`. Rejected because concurrent workers can race, application rollback becomes harder, and migration ownership is unclear.

### 7. Verification and release gates

PostgreSQL verification uses one repository-owned command backed by a dedicated Docker Compose file or profile and a version-pinned PostgreSQL image. The command creates an isolated Compose project and test database, waits on a PostgreSQL health check, supplies the resulting test URL only to the migration/adoption test process, and always removes its containers and volumes after success or failure. A failed container-runtime preflight, provisioning attempt, health check, or connection exits nonzero with an actionable error. Mandatory PostgreSQL tests do not convert those failures into skips; selecting the PostgreSQL verification command means all PostgreSQL cases must run.

Acceptance evidence includes:

- Settings matrix tests accepting local/test configurations and rejecting missing `APP_ENV`, SQLite in staging/production, missing, known, placeholder, or short secrets, wildcard/missing HTTP identity, and non-HTTPS deployed URLs.
- Staging/production startup tests proving all required providers are checked before traffic is served and any misconfigured, uninitializable, timed-out, or unavailable provider fails without exposing credentials.
- Backend tests run with controlled test settings and no real provider keys.
- Blank SQLite `upgrade head`, schema assertions, API startup, and no-DDL instrumentation.
- Legacy SQLite schema with representative rows, verify-and-stamp adoption, row-count checks, and API startup.
- Reproducibly provisioned ephemeral PostgreSQL blank upgrade and legacy adoption with schema, constraints, indexes, defaults, nullability, preserved-row checks, unconditional execution, and cleanup evidence.
- Revision-state failures for blank, behind, and divergent databases without writes.
- Baseline SQL/revision review and `alembic check` showing metadata and head are aligned.
- Existing backend suite after focused settings and migration tests.

Frontend lint/build, production image smoke tests, Compose production rendering, readiness behavior, and hosted CI evidence remain release gates for later environment-readiness work because this change does not alter those surfaces.

## Risks / Trade-offs

- [Existing local databases may have silent schema drift] -> Require structural comparison before stamping; never auto-repair or stamp mismatches.
- [Removing startup creation breaks fresh starts until migration runs] -> Treat this as an intentional breaking operational contract, update all setup/start commands, and fail with a precise migration instruction.
- [Provider readiness can make deployed startup depend on external availability] -> Check only providers required by active staging/production configuration, use bounded non-mutating checks, fail before traffic, and retain lazy validation for unrelated local/test paths.
- [SQLite and PostgreSQL represent defaults, booleans, JSON, and constraint names differently] -> Compare semantics rather than generated names where appropriate and verify both dialects on disposable databases.
- [Catalog seeding can obscure migration failures or write before revision validation] -> Run the read-only revision gate before any seed/checkpointer initialization.
- [The initial baseline downgrade would destroy preexisting application data] -> Make the baseline explicitly forward-only, abort its downgrade before destructive DDL, rollback the application without downgrading, and use tested backup/restore for accidental migration damage.
- [PostgreSQL tests could be skipped when local infrastructure is unavailable] -> Provision a version-pinned ephemeral instance through one repository command and make preflight or provisioning failures explicit test failures rather than skips.
- [A migration command could target the wrong database] -> Require explicit environment/database selection, log only sanitized dialect/host/database identity, and use disposable URLs in automated tests.

## Migration Plan

1. Add settings tests and the explicit environment contract; update local/test invocations and Compose to set `APP_ENV` and remove the known secret fallback.
2. Add Alembic configuration and the reviewed baseline, then prove blank SQLite and PostgreSQL upgrades before changing application startup.
3. Add and test the read-only legacy comparison/adoption path on representative copies or disposable reconstructions of the current schema.
4. Back up each existing non-disposable database and record representative row counts.
5. Stop API writers for the first adoption, run verify-then-stamp once, run `alembic upgrade head`, and verify revision plus row counts.
6. Deploy the API version with startup DDL removed; start one instance, verify the revision gate and required-provider startup checks, confirm smoke behavior, then start remaining workers.
7. For every later release, back up according to that revision's risk, run `alembic upgrade head` as one explicit job, deploy compatible application instances, and verify before promotion.

Rollback for this baseline change is application-first: stop the new API and redeploy the previous application while leaving the baseline stamp in place, because the baseline does not alter a compatible legacy schema. Do not run `downgrade base` on an adopted database; the baseline guard aborts such an attempt before destructive DDL. If the blank-database baseline itself proves incorrect before data is accepted, recreate that disposable database; if a non-disposable database is damaged, restore the pre-adoption backup or apply a reviewed forward fix.

## Open Questions

- The eventual CI provider and hosted PostgreSQL service remain intentionally undecided; verification commands must be provider-neutral.
- The long-term secret manager and production deployment owner remain deferred, but each deployment must still identify one migration owner before release.

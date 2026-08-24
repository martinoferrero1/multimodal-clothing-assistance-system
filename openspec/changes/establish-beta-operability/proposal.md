## Why

Lookeate has important application and security contracts, but no single reproducible delivery path proves that backend, frontend, migrations, security controls, and deployment behavior are ready for beta operation. Establishing those gates and operational procedures now reduces the risk of promoting an unverified build, losing data during recovery, or discovering CSP/HSTS problems only after production traffic arrives.

## What Changes

- Add mandatory CI gates for backend tests, frontend lint/build, migration verification, and security scans.
- Produce immutable, commit-tagged staging and production artifacts with a documented promotion path.
- Separate development and production Docker/Compose configuration and make deployed startup behavior explicit.
- Add liveness and readiness checks, graceful shutdown behavior, request/trace correlation, structured logs, and baseline metrics.
- Define initial beta SLOs and the evidence required to assess them.
- Document backup verification, restore drills, rollback, and migration recovery procedures.
- Add deployment smoke tests that exercise the deployed API and frontend boundary.
- Require staging evidence for the existing CSP/HSTS rollout before production promotion.

## Capabilities

### New Capabilities

- `ci-quality-gates`: Reproducible automated checks required before an artifact can be promoted.
- `immutable-delivery`: Commit-tagged build artifacts and controlled staging-to-production promotion.
- `runtime-operability`: Health checks, graceful shutdown, structured observability, and beta SLO evidence.
- `recovery-operations`: Backup, restore, rollback, and migration recovery procedures and verification.
- `deployment-smoke-tests`: Post-deployment checks for service health, core routes, and browser-facing behavior.

### Modified Capabilities

- `environment-configuration`: Define distinct development, staging, and production delivery configuration and startup readiness expectations.
- `schema-migrations`: Add release validation, migration recovery evidence, and operational handling for migration failures.
- `web-http-security`: Require staging CSP/HSTS rollout evidence as a promotion prerequisite.

## Impact

- CI workflow definitions, test and security tooling, and repository scripts.
- Dockerfiles, Compose files, image tagging, registry/promotion metadata, and deployment documentation.
- FastAPI and frontend runtime entrypoints, health endpoints, shutdown lifecycle, logging, request middleware, and metrics.
- Migration and database operations documentation plus disposable verification environments.
- Existing CSP/HSTS configuration and staging deployment evidence collection.

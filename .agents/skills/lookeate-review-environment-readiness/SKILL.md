---
name: lookeate-review-environment-readiness
description: Review Lookeate local, test, staging, and production environment decisions involving APP_ENV, Pydantic settings, secrets, env contracts, Docker and Compose, migrations, health checks, observability, CI, and release gates. Use when planning, implementing, or reviewing configuration and deployment readiness; do not use to author, approve, or automatically implement OpenSpec artifacts.
---

# Review Lookeate environment readiness

Evaluate whether a change behaves predictably across local, test, staging, and production without leaking secrets or carrying development shortcuts into a release.

## Respect the decision boundary

- Treat user-approved OpenSpec artifacts as scope input. Do not create, edit, approve, or complete them unless explicitly asked.
- Default to analysis and review. Modify configuration or deployment files only when the user requests implementation.
- Read `documentation/identity_guest_environments_plan.md` for the current environment roadmap.
- Do not choose a hosting provider, secret manager, email provider, or observability vendor unless the user places that decision in scope.
- Inspect environment variable names and documented contracts, never real `.env` values. Do not print, copy, rotate, or commit secrets.

## Follow the review workflow

1. Inspect settings, `.env.example`, Dockerfiles, Compose files, startup commands, health endpoints, migration commands, and CI workflows in scope.
2. Build an environment matrix for `local`, `test`, `staging`, and `production`.
3. Identify every development default and decide where it is permitted.
4. Trace build, migration, startup, readiness, rollback, and shutdown behavior.
5. Define release gates and observable evidence.

## Enforce environment invariants

- Require an explicit `APP_ENV` contract. Make staging and production fail closed when secrets, URLs, allowed origins or hosts, database requirements, secure cookies, or other mandatory settings are invalid.
- Keep tests independent from real LLM keys, external services, and the developer's `.env` whenever the tested feature does not need them.
- Keep `.env.example` non-secret, complete, and annotated by environment. Avoid hidden defaults that weaken staging or production.
- Use PostgreSQL for staging and production. Treat SQLite as local or test only unless an approved decision says otherwise.
- Run schema migrations as an explicit release step with one clear owner. Do not let each API process mutate the schema on startup.
- Use production images and commands without source mounts, hot reload, or development servers. Minimize privileges and exposed ports.
- Separate liveness from readiness. Include database or required dependency readiness only where it reflects the service's ability to serve traffic.
- Emit structured, non-sensitive logs and enough request or correlation context to diagnose authentication and migration failures.
- Define backup, restore, rollback, and forward-recovery expectations before the first production deployment.
- Make CI the final authority for deterministic tests, frontend lint/build, migration validation, and configuration smoke tests.

## Require verification evidence

Define the expected command and result for each applicable gate:

- settings tests for accepted local/test values and rejected staging/production defaults;
- backend tests without loading real provider secrets;
- frontend lint and production build;
- production container build and smoke start;
- Compose configuration rendering without exposing secret values;
- Alembic blank and existing-database upgrade checks;
- liveness/readiness behavior before and after dependencies become available;
- CI execution on the supported branch and pull-request events.

Do not call an environment production-ready solely because containers start locally.

## Return an environment review

Structure the result as:

1. **Environment matrix**
2. **Recommended decision** and alternatives
3. **Gaps by severity**
4. **Release and rollback sequence**
5. **CI and runtime evidence** required for acceptance
6. **Deferred provider choices**

Format a code finding as `[severity] path:line - environment risk - recommendation - verification`.

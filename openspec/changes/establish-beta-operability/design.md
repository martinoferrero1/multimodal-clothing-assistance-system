## Context

See `proposal.md` for the motivation and scope. The repository already has backend tests, a separate frontend package, Docker Compose support, explicit Alembic ownership, fail-closed deployed settings, and browser CSP/HSTS controls. The design must make those existing contracts executable as release evidence without introducing provider credentials into CI or allowing API workers to own migrations.

## Goals / Non-Goals

**Goals:**

- Establish one blocking verification pipeline that produces traceable backend, frontend, migration, and security evidence.
- Build once, identify artifacts by commit and digest, and promote the same artifact from staging to production.
- Make runtime health, shutdown, logs, metrics, request correlation, and initial SLO measurements operationally useful.
- Provide tested recovery procedures and a promotion gate for staging CSP/HSTS evidence.

**Non-Goals:**

- Replacing the existing authentication, provider, database, or frontend architecture.
- Adding a full observability platform, autoscaling policy, or multi-region disaster-recovery system.
- Changing product features or the Lookeate user experience beyond operational behavior and required security headers.

## Decisions

### One blocking CI workflow with reusable repository checks

CI will call repository-owned Bash entrypoints for backend tests, frontend lint/build, migration checks, security scans, and smoke tests. This keeps local and CI commands aligned and avoids duplicating business logic in workflow YAML. Required checks fail closed when Docker, PostgreSQL, or a scanner is unavailable. A matrix may parallelize independent checks, but artifact publication waits for all required results.

Alternative considered: advisory scans and best-effort migration jobs. Rejected because silently skipped checks undermine the stated promotion contract.

### Build once, promote by digest

The delivery pipeline will build deployable images once after CI, attach commit and dependency metadata, record immutable digests, deploy that digest to staging, and promote the same digest. Environment configuration remains external to the image and is validated before startup. Rollback points to the prior verified digest rather than rebuilding from a branch.

Alternative considered: rebuild separately for staging and production. Rejected because it permits unverified drift between environments.

### Separate Compose concerns by environment

Development Compose will retain local conveniences such as SQLite-compatible workflows where supported and source-mounted iteration. Deployed Compose definitions will use PostgreSQL, explicit health dependencies, immutable image references, non-development settings, and bounded shutdown periods. Shared fragments may define service shape, but environment-specific files own secrets, volumes, ports, and operational policies.

Alternative considered: one file controlled entirely by environment variables. Rejected because unsafe development defaults become too easy to carry into deployment.

### Health checks as orchestration contracts

Liveness will remain a cheap process-level check. Readiness will verify migration head and required configured dependencies without exposing connection details. Deployment orchestration and smoke tests will use readiness for traffic eligibility, while liveness avoids restart loops caused by a downstream outage.

Alternative considered: one combined health endpoint. Rejected because it conflates restart health with dependency readiness.

### Structured telemetry at the API boundary

A middleware boundary will establish or propagate a request/trace ID, emit one structured completion/error event, and update basic request counters, latency, and dependency failure metrics. Redaction will be centralized and tested against credentials, cookies, tokens, and provider data. Shutdown lifecycle hooks will mark draining state and close database/provider resources within a configured grace period.

Alternative considered: application-specific logging in every route and graph node. Rejected because coverage and redaction would be inconsistent.

### Evidence-based security promotion

Staging smoke tests will capture CSP mode, effective CSP/HSTS headers, report-only violations, HTTPS termination assumptions, and relevant browser/API responses. A reviewable evidence record tied to the artifact digest is required before enforced production promotion. Local HTTP remains explicitly exempt from HSTS.

Alternative considered: enabling HSTS/CSP enforcement solely by configuration flag. Rejected because a flag cannot prove that the deployed proxy and browser boundary behave as expected.

### Recovery procedures are tested before release

Backup/restore drills use an isolated disposable target and record integrity, duration, and achieved recovery objectives. Migration releases declare downgrade or forward-only behavior and exercise the selected path. Release documentation contains decision trees for rollback, restore, and forward recovery, with application/database compatibility called out.

Alternative considered: documenting recovery without drills. Rejected because untested backups and rollback steps are not operational evidence.

## Risks / Trade-offs

- [CI duration increases] -> Parallelize independent checks and cache only immutable, integrity-checked dependencies; never cache test state or credentials.
- [Readiness checks create startup coupling] -> Keep liveness independent and give each dependency a bounded timeout with actionable, non-sensitive diagnostics.
- [Metrics and logs can leak user or provider data] -> Use allowlisted fields, centralized redaction, negative tests, and prohibit raw request bodies and headers.
- [Production promotion can be blocked by incomplete staging evidence] -> Make evidence collection part of the staging smoke job and expose a clear missing-evidence failure.
- [Forward-only migrations limit rollback] -> Require backups, compatibility sequencing, and a documented forward-recovery owner before applying them.
- [Compose parity may drift] -> Keep shared service definitions small, pin images, and run deployment smoke tests against the deployed configuration in CI or staging.

## Migration Plan

1. Add repository checks, environment-specific Compose files, health/lifecycle behavior, telemetry, and smoke-test fixtures without changing production traffic.
2. Run the full blocking pipeline on a clean checkout and publish a commit-addressed staging artifact.
3. Deploy staging, run smoke tests, collect CSP/HSTS evidence, and complete a backup/restore drill.
4. Promote the exact verified digest to production only after all evidence is attached.
5. If rollout fails, stop traffic to the unhealthy instance and redeploy the previous verified digest. If a migration has already changed schema, use its declared forward-recovery or restore procedure rather than an unsafe downgrade.

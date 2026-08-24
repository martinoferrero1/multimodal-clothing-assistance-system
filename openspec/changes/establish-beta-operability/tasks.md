## 1. Repository Verification

- [x] 1.1 Inventory current backend, frontend, Docker Compose, migration, security, and test commands and define one documented command for each required gate.
- [x] 1.2 Add clean-checkout Bash verification entrypoints with strict error handling, pinned or bounded tool versions, redacted output, and explicit failure when required prerequisites are unavailable.
- [x] 1.3 Add backend test, frontend lint/build, dependency/code security, secret-detection, and static configuration checks as blocking CI jobs.
- [x] 1.4 Add disposable PostgreSQL migration and legacy-adoption verification to CI, including cleanup on success and failure.

## 2. Delivery And Environment Separation

- [x] 2.1 Define development and deployed Docker/Compose configurations with explicit PostgreSQL, health dependencies, shutdown grace periods, and no inherited development secrets in staging or production.
- [x] 2.2 Implement commit metadata, immutable image tagging, digest recording, and artifact manifest generation for backend and frontend deliverables.
- [x] 2.3 Add promotion validation that requires all CI results and deploys the exact staging-verified artifact digest to production.
- [x] 2.4 Extend deployed configuration validation and example environment documentation for artifact identity, health checks, telemetry, delivery settings, and fail-closed staging/production behavior.

## 3. Runtime Lifecycle And Observability

- [x] 3.1 Add separate non-sensitive liveness and readiness endpoints, including migration-head and required-dependency readiness checks with bounded timeouts.
- [x] 3.2 Add graceful shutdown draining, bounded termination behavior, and resource cleanup for API workers and frontend-facing services.
- [x] 3.3 Add request/trace ID propagation and structured request, error, startup, shutdown, health, and dependency logs with centralized sensitive-field redaction.
- [x] 3.4 Add basic request count, latency, error, dependency-failure, and readiness metrics and document initial beta availability, latency, error-rate, and recovery SLOs.

## 4. Smoke Tests And Security Evidence

- [x] 4.1 Implement deployment smoke tests for liveness, readiness, frontend loading, authentication-safe routing, core API behavior, and required browser-facing security headers.
- [x] 4.2 Make smoke tests use disposable identities or non-sensitive probes and redact credentials, cookies, tokens, and secrets from logs and reports.
- [ ] 4.3 Capture staging CSP report-only/enforced behavior, violation evidence, HTTPS termination confirmation, and HSTS responses in an artifact-digest-bound report.
- [ ] 4.4 Require reviewed staging CSP/HSTS evidence before production security enforcement or promotion and verify local HTTP remains free of HSTS.

## 5. Recovery And Release Operations

- [x] 5.1 Document backup scope, retention, encryption, ownership, restore objectives, and an isolated restore-drill procedure with integrity and duration evidence.
- [x] 5.2 Extend migration release checks and documentation to record downgrade or forward-only behavior, compatibility constraints, backup requirements, and recovery decisions.
- [x] 5.3 Define release rollback and migration failure decision trees that select immutable artifact redeploy, forward recovery, or backup restore without unsafe schema downgrade.
- [ ] 5.4 Run and record a staging backup/restore drill, migration recovery verification, deployment smoke test, and beta SLO evidence review as release prerequisites.

## 6. Final Promotion Gate

- [ ] 6.1 Execute the complete blocking pipeline from a clean checkout and publish the commit-addressed artifact manifest and evidence bundle.
- [ ] 6.2 Deploy the exact artifact to staging and verify health, smoke tests, security evidence, migration state, and recovery prerequisites.
- [ ] 6.3 Promote only the verified digest to production, record the rollback target, and verify production readiness and initial telemetry.

---
name: lookeate-review-migration-safety
description: Review Lookeate database model, schema, Alembic migration, data backfill, constraint, index, and startup-DDL decisions for safe rollout and rollback. Use when planning, implementing, or reviewing SQLAlchemy or PostgreSQL and SQLite schema changes; do not use to author, approve, or automatically implement OpenSpec artifacts.
---

# Review Lookeate migration safety

Evaluate schema and data changes as production operations, not only as model edits. Require a safe path for both an empty database and existing Lookeate data.

## Respect the decision boundary

- Treat user-approved OpenSpec artifacts as scope input. Do not create, edit, approve, or complete them unless explicitly asked.
- Default to analysis and review. Modify models or migrations only when the user asks for implementation.
- Read `documentation/identity_guest_environments_plan.md` when the change belongs to the identity or environment roadmap.
- Never run a migration against staging or production without explicit authorization and an identified target.

## Follow the review workflow

1. Inspect the affected SQLAlchemy models, database initialization, migration history, constraints, indexes, and representative data shape.
2. Classify the rollout as expand, migrate, contract, or a combination.
3. Compare behavior on a blank database and on the currently deployed schema.
4. Assess locks, transaction duration, backfill volume, application compatibility, and rollback strategy.
5. Define disposable-database verification before accepting the change.

## Enforce migration invariants

- Use versioned Alembic revisions as the schema authority. Do not add new runtime `CREATE TABLE` or `ALTER TABLE` behavior to application startup.
- Keep SQLAlchemy metadata and migration revisions aligned. Never assume `Base.metadata.create_all` upgrades an existing schema.
- Preserve existing rows by default. Require explicit user scope for destructive deletion, column narrowing, irreversible transformation, or history loss.
- Give constraints and indexes stable names. Review uniqueness, nullability, foreign-key behavior, cascades, and query indexes deliberately.
- Make backfills deterministic and restartable. Separate large data movement from blocking schema changes when appropriate.
- Prefer expand-and-contract when old and new application versions may overlap during deployment.
- Account for PostgreSQL as the production target and SQLite where local or test support remains promised. Call out dialect-specific SQL explicitly.
- Provide a downgrade path when it can be safe. When downgrade is unsafe, document the reason and provide a forward-recovery or restore plan.
- Keep migrations independent from LLM providers, external APIs, application singletons, and real `.env` secrets.

## Require verification evidence

At minimum, define and, when implementation is requested, execute the applicable checks:

- upgrade a blank disposable database to `head`;
- upgrade a database representing the pre-change revision to `head`;
- verify constraints, indexes, defaults, nullability, and preserved row counts;
- exercise downgrade and re-upgrade, or verify the documented forward-only recovery plan;
- start the API after migration and confirm startup performs no DDL;
- run relevant repository tests against the supported database dialects.

Never infer migration safety only from generated SQL or a successful model import.

## Return a migration review

Structure the result as:

1. **Current and target schema**
2. **Recommended rollout sequence**
3. **Data preservation and compatibility risks**
4. **Rollback or forward-recovery plan**
5. **Verification matrix** for blank and existing databases
6. **Findings**, ordered by severity

Format a code finding as `[severity] path:line - migration risk - safe path - verification`.

## Context

Lookeate already uses opaque, revocable server-side sessions in an HttpOnly cookie, CSRF-bound browser requests, a same-origin Next.js BFF, async SQLAlchemy services, and Alembic as the only schema authority. `ChatUser` is currently the human identity and `AuthSession` is user-bound only. See `proposal.md` and the identity roadmap for motivation and the existing identity baseline.

## Goals / Non-Goals

**Goals:**
- Add commercial tenancy without reclassifying a human account as a single store.
- Gate commercial access on email verification, MFA, manual approval, active store state, and active owner membership.
- Keep the existing cookie, CSRF, non-enumeration, transaction, and same-origin boundaries intact.
- Make state and privilege changes immediately revocable, observable, recoverable, and testable on PostgreSQL and SQLite.

**Non-Goals:**
- Consumer MFA, social login, SSO, payments, catalog ingestion, or a public store-management API.
- Additional store roles beyond `owner`, self-service membership invitations, or automatic guest promotion.
- Selecting an email, MFA, telemetry, or secret-management vendor; implementations use configured adapters and fail closed where the dependency is required.

## Decisions

### Public submission with approval-gated activation

Store registration is publicly reachable, but it creates only a `pending` tenant. Email verification, confirmed TOTP enrollment, and a separate platform-approver decision are all required before a store becomes `active`; approval may be recorded earlier but cannot activate the tenant before the other prerequisites.

This permits legitimate self-service applications without granting commercial access to an unreviewed entity. Immediate activation was rejected because it makes fraudulent or incorrectly registered stores immediately privileged. Invitation-only registration was rejected because the requested flow explicitly includes public registration and applicant states.

### Human identity, tenant, and membership are separate records

`ChatUser` remains the human actor. `Store` owns commercial identity and lifecycle data. `StoreMembership` joins a human actor to a store and initially supports only `owner`; a named uniqueness strategy ensures one active owner per store. Existing people are backfilled as `consumer` account kind where needed, with no synthetic store or membership.

This supports a person owning multiple stores and preserves their personal data. Encoding a store value in `ChatUser.account_type` was rejected because it cannot represent many-to-many ownership or independent store lifecycle states.

### Store state and data model

The migration adds `stores`, `store_memberships`, `store_verification_tokens`, and `user_mfa_credentials`, adds an account-kind and email-verification marker to `chat_users`, and adds nullable `active_store_id` to `auth_sessions`. Store data includes legal and display names, public handle, jurisdiction, business identifier, address, contact email, and phone. Store states are `pending`, `active`, `rejected`, and `suspended`; memberships retain role, creation, and revocation metadata.

Verification values are random, short-lived, single-use, and stored only as hashes. TOTP seed material is encrypted at rest with a production-required key and never returned after initial provisioning; its use produces a timestamped verification record. TOTP is selected as the initial MFA factor because it can be implemented without a third-party identity provider. Recovery is an operator-controlled ownership-transfer or suspension procedure rather than weaker self-service fallback codes.

### Session-bound active store context

`AuthSession.active_store_id` is the sole selected commercial context. Selecting a store validates the current user’s active owner membership and the store's active state, revokes the prior session, then issues a replacement session inside the same transaction. Commercial route dependencies load the session, store, and membership together and pass a `CommercialContext` to handlers; they never authorize a client-supplied store identifier.

This provides safe multi-store switching and lets suspension or ownership change revoke only sessions bound to the affected store. Deriving a store directly from each request was rejected because a client-supplied identifier would be confused with authorization and cannot support reliable session revocation by tenant.

### Registration and activation flow

1. `POST /api/auth/store/register` applies a dedicated rate limit and, in one transaction, creates a new consumer user, pending store, owner membership, and hashed email-verification challenge.
2. It returns the same generic acknowledgement for accepted and duplicate submissions, without a session. A guest cookie is not promoted and receives the same acknowledgement without commercial records.
3. The prospective owner submits the emailed value with same-origin `POST /api/auth/store/verify-email`; on one-time success, the system marks the email verified, consumes the challenge, and issues a session bound to the pending store.
4. The owner enrolls and confirms TOTP through CSRF-protected authenticated endpoints. The BFF renders the provisioning value without browser persistence.
5. A globally authorized platform approver uses protected approval endpoints. Approval verifies both prerequisites and activates the store atomically, emitting an audit event.
6. The session endpoint returns only safe selected-store status for the onboarding UI. Commercial dependencies enforce `active` store, active `owner` membership, verified email, and confirmed MFA.

The approver is a platform authorization concern, not a `StoreMembership` role. The first implementation uses a server-side configured approver allowlist, required and fail-closed outside local/test, until a separate platform-administration model is approved.

### Privilege invalidation and auditability

Store rejection, suspension, ownership transfer, membership revocation, and sensitive approval actions are transactional. Each writes a structured security event and revokes sessions with the affected `active_store_id`; normal personal or separately bound store sessions remain independently evaluable. A privileged ownership transfer additionally requires a fresh TOTP step-up according to a configured maximum age.

Audit events contain stable IDs, actor/target references, event type, outcome, timestamp, and correlation metadata. They exclude passwords, raw tokens, TOTP seeds, cookie values, and CSRF material. Metrics count registration requests, verification outcomes, approvals, rejections, suspensions, and rate-limit results using non-PII labels.

### API and BFF boundary

New API schemas expose only safe actor and store status. Routes remain orchestration-only and services own the transaction and revocation behavior. The Next.js proxy forwards cookies, approved origin/CSRF headers, and all `Set-Cookie` values unchanged. Anonymous mutating verification uses allowed-origin and Fetch Metadata checks; authenticated mutations additionally require the session-bound CSRF value. All registration conflicts use generic public responses, while authenticated authorization failures use `401` or `403` as established.

## Risks / Trade-offs

- [Pending accounts create dormant data] -> Expire unverified registrations on a documented retention schedule and audit cleanup without deleting active commercial records.
- [TOTP seed compromise] -> Encrypt seeds with a required production key, minimize access, never log or return them after provisioning, and revoke or transfer ownership on suspected compromise.
- [Approver allowlist is operationally limited] -> Fail closed outside local/test, audit every decision, and replace it only through a separately approved platform-administration change.
- [Partial unique owner enforcement differs by dialect] -> Use explicit dialect-tested indexes or transaction checks that produce the same one-active-owner behavior in PostgreSQL and SQLite.
- [Migration changes identity data] -> Use expand-only additions and deterministic backfill, exercise upgrade from the prior revision, and retain a documented backup/forward-recovery path.
- [Store status can become stale in a session] -> Re-resolve store and membership in the common authorization dependency for every commercial request and revoke affected bound sessions transactionally.

## Migration Plan

1. Add models and an Alembic expand migration with named constraints, indexes, nullable session context, account markers, and no runtime DDL.
2. Deterministically mark existing human accounts as consumers while preserving all existing users and related rows; create no stores or memberships for them.
3. Run blank-database and prior-revision upgrades on disposable SQLite and PostgreSQL databases; assert row counts, constraints, indexes, and no API-startup DDL.
4. Deploy the migration as one explicit release job before application workers. Configure the TOTP encryption key, approver allowlist, email adapter, rate-limit backend, and retention values; staging and production reject missing requirements.
5. Deploy backend/BFF/frontend support, execute registration-to-activation smoke tests in staging, and monitor audit events and metrics.
6. Treat the migration as forward-only after commercial records exist: restore a verified pre-migration backup for release rollback or deploy a corrective forward migration. Document the recorded Alembic revision and recovery decision.

## Open Questions

- The retention duration for unverified or rejected store applications can be selected operationally without changing the identity, authorization, or migration approach.

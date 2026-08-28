## 1. Contracts and configuration

- [x] 1.1 Define explicit backend request and safe response schemas for store registration, verification, MFA enrollment/confirmation, status, selection, approval, suspension, rejection, and ownership transfer.
- [x] 1.2 Add validated settings for the email adapter, TOTP encryption key, owner step-up maximum age, registration retention, approver allowlist, and commercial rate-limit policies; make required staging and production settings fail closed.
- [x] 1.3 Extend the shared rate-limit policy registry and non-PII metrics for store registration, verification, MFA confirmation, and approval.

## 2. Commercial identity persistence

- [x] 2.1 Add SQLAlchemy models and relationships for Store, StoreMembership, verification-token metadata, MFA credential material, ownership audit events, ChatUser consumer/email-verification markers, and AuthSession active-store context.
- [x] 2.2 Define named foreign keys, lifecycle and role constraints, uniqueness rules, ownership indexes, and PostgreSQL/SQLite-compatible enforcement for one active owner per store.
- [x] 2.3 Create an Alembic expand migration that adds the commercial identity schema and deterministically classifies existing human users as consumers without creating synthetic stores or memberships.
- [x] 2.4 Add disposable SQLite and PostgreSQL migration coverage for blank upgrades, upgrades from the preceding revision, preserved row counts, schema integrity, API startup without DDL, and the documented downgrade or forward-recovery path.

## 3. Store registration and activation services

- [x] 3.1 Implement the transactional store-registration service that creates a new consumer user, pending store, owner membership, and hashed one-time verification challenge, while rolling back all records on failure.
- [x] 3.2 Implement generic duplicate and guest-registration handling that preserves non-enumerating responses, does not create commercial records for conflicts, and never automatically promotes a guest to store owner.
- [x] 3.3 Implement secure email challenge delivery and verification with random hashed values, expiration, one-time consumption, origin checks, and no URL or Web Storage persistence.
- [x] 3.4 Implement encrypted TOTP provisioning and confirmation for prospective owners, including session-bound recent step-up evidence for sensitive ownership actions.
- [x] 3.5 Implement approved platform-operator authorization, pending-store approval, rejection, suspension, restoration, and ownership-transfer services with security audit events and transactional session revocation.
- [x] 3.6 Add thin FastAPI routes under `/api/auth/store/` for registration, verification, MFA, status, selection, and protected operator actions, preserving cookie, Origin/Referer, Fetch Metadata, CSRF, and generic-error behavior.

## 4. Multi-tenant authorization and sessions

- [x] 4.1 Extend session issuance, rotation, restoration, and revocation to persist and safely expose selected-store status without exposing credentials, MFA secrets, or other-store membership data.
- [x] 4.2 Implement the protected store-selection operation that validates active owner membership server-side, rotates the session, and stores the active context only after successful validation.
- [x] 4.3 Add a reusable commercial authorization dependency that resolves session, active store, membership, lifecycle, email verification, MFA eligibility, and required role entirely on the server.
- [x] 4.4 Apply the commercial authorization dependency to commercial routes and ensure every suspension, rejection, membership revocation, or ownership transfer invalidates sessions bound to the affected store.

## 5. Browser onboarding and BFF integration

- [x] 5.1 Extend the frontend API client, same-origin proxy, and auth state to carry safe store-status data and preserve all upstream cookie and CSRF behavior.
- [x] 5.2 Add separate Lookeate onboarding choices and validated flows for "Crear cuenta personal" and "Registrar una tienda".
- [x] 5.3 Build store onboarding/status surfaces for pending verification, TOTP enrollment, pending approval, rejection, suspension, active access, and safe support guidance.
- [x] 5.4 Verify the frontend keeps passwords, verification values, MFA secrets, session credentials, and CSRF values out of Web Storage, URLs, browser-readable cookies, and client logs.

## 6. Security, flow, and regression verification

- [x] 6.1 Add backend tests for atomic registration rollback, duplicate email/store non-enumeration, guest rejection, token expiration/reuse, TOTP eligibility, and commercial rate-limit exhaustion.
- [x] 6.2 Add authorization tests for missing membership, forged or cross-tenant store identifiers, ineligible store selection, revoked owner membership, suspended/rejected stores, session rotation, and store-bound session invalidation.
- [x] 6.3 Add end-to-end coverage for registration, email verification, MFA confirmation, approval, commercial access, ownership transfer, and post-suspension denial.
- [x] 6.4 Add frontend tests for registration choice, pending-state restoration, protected status surfaces, and absence of sensitive browser persistence; run frontend lint and production build.
- [x] 6.5 Run focused backend tests, the full backend suite, and the repository's SQLite/PostgreSQL migration verification; record any unavailable environment-dependent checks explicitly.

## 7. Operations and audit documentation

- [x] 7.1 Document audit event taxonomy, non-PII metrics, alerting signals, and operational access controls for store registrations, approvals, rejections, suspensions, and ownership changes.
- [x] 7.2 Document the authorized ownership-transfer and MFA-loss procedure, including verification, session revocation, suspension fallback, and evidence retention.
- [x] 7.3 Update backup, restore, release, and forward-recovery procedures for commercial identity data and perform a recorded isolated restore drill before production promotion.

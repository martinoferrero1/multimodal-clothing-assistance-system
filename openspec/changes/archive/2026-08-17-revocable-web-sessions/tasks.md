## 1. Session Configuration Contract

- [x] 1.1 Replace legacy bearer-token settings with validated idle lifetime, absolute lifetime, touch interval, cookie name, `Secure`, `SameSite`, and CSRF binding settings while keeping cookie path and domain invariants fixed.
- [x] 1.2 Add settings tests for valid local/test values, lifetime inconsistencies, and staging/production rejection of weak secrets, insecure cookies, non-`__Host-` names, and non-HTTPS origins.
- [x] 1.3 Update `.env.example` and relevant runtime documentation with the non-secret session, cookie, CSRF, and origin contract, clearly separating local/test allowances from deployed requirements.

## 2. Session Persistence And Migration

- [x] 2.1 Add the `AuthSession` SQLAlchemy model and `ChatUser` relationship with hashed-token uniqueness, user/revocation and expiration indexes, timezone-aware lifecycle timestamps, controlled revoke reasons, and cascading cleanup on user deletion.
- [x] 2.2 Add an Alembic revision after `20260814_0001` that creates only `auth_sessions` with stable names and provides a safe downgrade that drops only session data.
- [x] 2.3 Extend SQLite migration tests for blank-to-head, baseline-to-head with preserved users and owned data, schema/metadata equivalence, and downgrade/re-upgrade behavior.
- [x] 2.4 Extend ephemeral PostgreSQL migration verification for the new table, constraints, indexes, preserved row counts, downgrade/re-upgrade, and API startup at head without runtime DDL.

## 3. Server Session Lifecycle

- [x] 3.1 Implement CSPRNG session-token creation, SHA-256 lookup hashing, versioned session-bound CSRF derivation and constant-time validation, ensuring no raw session or CSRF value is persisted or logged.
- [x] 3.2 Implement centralized session cookie issue and deletion helpers with matching attributes for local/test and staging/production.
- [x] 3.3 Implement transactional session creation, lookup, throttled activity touching, idle and absolute expiration, current-session revocation, user-wide revocation, and rotation with bounded revoke reasons.
- [x] 3.4 Add focused lifecycle tests for creation, hash-only persistence, touch throttling, idle expiry, absolute expiry, rotation failure atomicity, revoked/rotated replay, current logout, logout-all isolation between two users, and concurrent-safe expiration bounds.

## 4. FastAPI Authentication And Request Security

- [x] 4.1 Replace bearer resolution with a cookie-based current-session dependency that returns server-derived session and user context, uses one generic `401` contract, and clears presented invalid cookies.
- [x] 4.2 Refactor registration and login so user/session writes are atomic, existing browser sessions rotate only after successful authentication, responses contain `{ user, csrf_token }`, and account failures do not enumerate email existence.
- [x] 4.3 Add `GET /api/auth/session`, `POST /api/auth/logout`, and `POST /api/auth/logout-all` with the specified restoration, revocation, all-sessions, CSRF, cookie-deletion, and status-code contracts.
- [x] 4.4 Add unsafe-method origin middleware with exact allowed-origin matching, controlled `Referer` fallback, and Fetch Metadata rejection, then require the session-bound `X-CSRF-Token` on every unsafe authenticated route.
- [x] 4.5 Inventory API routes to confirm no state change uses `GET` and every protected resource continues deriving ownership from the session actor rather than request user IDs.
- [x] 4.6 Add API security tests for cookie flags and deletion, valid restoration and mutation, missing/malformed/expired/revoked/rotated sessions, legacy bearer rejection, missing/invalid CSRF, disallowed/missing origin evidence, cross-site Fetch Metadata, generic auth failures, and cross-user access denial.

## 5. Next.js Proxy Boundary

- [x] 5.1 Change the catch-all proxy allowlist to forward `Cookie`, content negotiation, approved origin/referer, `X-CSRF-Token`, and relevant Fetch Metadata headers while removing `Authorization` forwarding.
- [x] 5.2 Preserve each upstream `Set-Cookie` value separately for issue and deletion responses without synthesizing cookies or exposing the backend URL.
- [x] 5.3 Add the frontend test runner and route-handler tests covering request cookie/header forwarding, dropped authorization and arbitrary headers, one and multiple `Set-Cookie` values including `Expires`, cookie deletion, and responses without cookies.

## 6. Frontend Session Cutover

- [x] 6.1 Replace token-bearing TypeScript contracts and API-client token parameters with credential-free session responses, `credentials: "same-origin"`, and runtime CSRF headers for unsafe requests.
- [x] 6.2 Refactor the auth provider to use `loading`, `authenticated`, and `anonymous`, restore through `/api/auth/session`, hold user/CSRF state only in memory, handle `401` transitions, and make logout asynchronous.
- [x] 6.3 Remove browser auth-session storage helpers and bearer fallback behavior, while deleting the legacy `digital-atelier-session` value once without changing non-sensitive preference storage.
- [x] 6.4 Update conversation, settings, workspace guards, login/register flows, logout controls, and all authenticated API consumers to stop reading or passing tokens and to use the new provider contract.
- [x] 6.5 Add frontend tests for valid and anonymous initialization, credential-free login/registration, runtime-only CSRF use, legacy storage deletion, `401` state clearing, `403` preservation, awaited logout success/failure, and authenticated/anonymous redirects.

## 7. Integrated Verification And Handoff

- [x] 7.1 Run the focused auth, settings, ownership, startup, and SQLite migration tests with `APP_ENV=test PYTHONPATH=src python -m pytest`, then run the complete backend suite with `APP_ENV=test PYTHONPATH=src python -m pytest tests/`.
- [x] 7.2 Run `bash scripts/verify_postgresql_migrations.sh` and confirm blank, baseline-upgrade, downgrade/re-upgrade, preserved-data, and no-startup-DDL checks pass against ephemeral PostgreSQL.
- [x] 7.3 Run the frontend test suite, `npm run lint`, and `npm run build` from `src/frontend`, confirming generated bundles and test output contain no session, CSRF, or server-secret values.
- [x] 7.4 Perform same-origin BFF smoke tests for register, login, restore, protected mutation, logout replay rejection, two-client logout-all, invalid CSRF, and cross-site origin rejection; record only non-sensitive results.
- [x] 7.5 Document the migration-first atomic deployment, forced reauthentication, configuration gate, forward-repair preference, and coordinated application/database rollback procedure.

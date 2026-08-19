## Context

See `proposal.md` for motivation and `specs/web-session-authentication/spec.md` for the behavioral contract.

The browser currently restores a complete bearer-token response from `localStorage`, passes the token through frontend providers and API functions, and sends `Authorization` through the Next.js catch-all proxy. The proxy drops browser cookies and upstream `Set-Cookie` headers. FastAPI's shared dependency validates a stateless HMAC token and returns `ChatUser`; protected services already derive ownership from that server-resolved user.

Alembic is already the only schema owner. The current head is the forward-only application baseline, normal API startup checks that the database is at head without performing DDL, PostgreSQL is the deployed database, and SQLite remains supported for local/test. Settings already distinguish `local`, `test`, `staging`, and `production` and validate public URLs and allowed origins, but those origins are not yet enforced on requests.

This is an atomic web-auth contract change across the browser, BFF, API, configuration, and database. There is no shipped need to accept legacy bearer tokens after deployment.

## Goals / Non-Goals

**Goals:**

- Keep the opaque authentication credential inaccessible to browser JavaScript and store only its hash in the database.
- Make session validity, idle/absolute expiration, rotation, and revocation authoritative on the server.
- Preserve the existing server-derived ownership boundary while changing how the actor is resolved.
- Apply origin, Fetch Metadata, and session-bound CSRF checks consistently to unsafe browser requests.
- Make blank and baseline databases upgrade safely on PostgreSQL and SQLite, with an explicit reversible session-table revision.
- Provide focused acceptance evidence at the service, API, migration, proxy, and frontend state-management boundaries.

**Non-Goals:**

- Guest identities or sessions, guest promotion, account status fields, email verification, recovery, password changes, MFA, OAuth/OIDC, mobile clients, or a public API authentication scheme.
- A session/device management UI or collection of IP addresses and user-agent fingerprints. The initial session model deliberately stores no device metadata.
- Maintaining bearer-token compatibility, migrating existing bearer tokens, or preserving logged-in browser state across the cutover.
- Selecting or adding a shared rate-limit provider. Existing login/registration abuse controls remain a separate security gap and must be addressed before public launch.

## Decisions

### Use one opaque token and one persisted session row

Generate 32 random bytes with the platform CSPRNG and encode them as a URL-safe token. Put the raw token only in the session cookie and hash it with SHA-256 for lookup. High token entropy makes a separate hash pepper unnecessary; a database leak does not expose a reusable token or a realistically brute-forceable value.

Add `AuthSession` alongside the existing chat models with:

- `id`: application-generated UUID string, matching repository conventions.
- `user_id`: required foreign key to `chat_users.id` with `ON DELETE CASCADE`.
- `token_hash`: fixed-length SHA-256 hex value with a named unique constraint.
- `created_at`, `last_seen_at`, `idle_expires_at`, and `absolute_expires_at`: timezone-aware timestamps.
- `revoked_at`: nullable timezone-aware timestamp.
- `revoke_reason`: nullable bounded string using controlled internal reason values.

Use named indexes for `token_hash`, `(user_id, revoked_at)`, and expiration cleanup queries. Do not persist the raw token, CSRF value, IP address, user agent, or another browser fingerprint. Session display metadata can be designed with its UI and retention policy later.

Alternative considered: signed access and refresh tokens. Rejected because server-side revocation would still require persistence or deny lists, while the web-only same-origin BFF has no need for portable tokens.

Alternative considered: encrypting and storing the token. Rejected because authentication only needs equality lookup; hashing provides a smaller breach surface.

### Make session creation and rotation transactional

Refactor registration so user creation and initial session creation share one database transaction. Login verifies the password, then creates a session in a transaction. If the request carries an existing valid session cookie, successful login or registration revokes that row with reason `rotated` in the same transaction before committing the replacement. This also handles switching accounts in one browser without leaving the prior cookie session active.

Rotation failure returns no replacement cookie. A committed replacement is the only point at which the response sets its raw token. Replayed rotated tokens follow the same generic invalid-session path as unknown, expired, and revoked tokens.

Alternative considered: a public rotate endpoint or periodic rotation on every request. Rejected because it increases races and proxy complexity without an additional authentication boundary in the current scope. Future credential or privilege changes must call the same internal rotate operation.

### Enforce idle and absolute expiration during actor resolution

Replace bearer resolution in the shared API dependency with cookie resolution:

1. Read the environment-specific session cookie.
2. Hash its token and load the session plus user.
3. Reject missing, malformed, unknown, revoked, idle-expired, or absolute-expired sessions with the same public `401` response.
4. For a valid session, return an internal current-session context containing both user and session so logout and CSRF checks never trust client IDs.
5. Advance `last_seen_at` and `idle_expires_at` only after the configured touch interval, capped by `absolute_expires_at`, to avoid a database write on every request.

Initial documented values are a 60-minute idle timeout, a 7-day absolute timeout, and a 5-minute touch interval. They remain settings so deployments can shorten them without code changes. Expired sessions are marked revoked opportunistically; correctness never depends on a cleanup job. A later maintenance job may delete expired/revoked rows.

The cookie expiry is capped at the absolute timeout for browser cleanup, but database timestamps remain authoritative. A centralized invalid-session response clears a presented invalid cookie with the same attributes used to issue it.

Alternative considered: client-side expiry. Rejected because it can be bypassed and cannot enforce revocation.

### Use credential-free session responses

Use these contracts:

- `POST /api/auth/register`: `201` with `{ user, csrf_token }` and `Set-Cookie`.
- `POST /api/auth/login`: `200` with `{ user, csrf_token }` and `Set-Cookie`.
- `GET /api/auth/session`: `200` with `{ user, csrf_token }` for a valid session.
- `POST /api/auth/logout`: `204`, revokes the current session and clears the cookie.
- `POST /api/auth/logout-all`: `204`, revokes all active sessions for the current user, including the caller, and clears the cookie.

The CSRF value is not an authentication credential and is useless without the `HttpOnly` cookie. Login failures for unknown email and incorrect password retain one generic contract. Duplicate registration uses a generic conflict response that does not confirm whether the email is already registered. Session failures do not expose the failed validation branch and logs must exclude cookies, token hashes, raw tokens, CSRF values, passwords, and request authorization headers.

Alternative considered: make logout-all preserve the current session. Rejected because it conflicts with the endpoint name and weakens a user's expectation that every credential has been invalidated.

### Bind CSRF tokens to sessions without storing another raw secret

Derive the CSRF value as a versioned HMAC-SHA-256 over the session ID and token hash using a dedicated `SESSION_CSRF_SECRET`, encode it URL-safely, and return it in credential-free session responses. Compare `X-CSRF-Token` in constant time on unsafe cookie-authenticated requests. Rotation changes the session and therefore invalidates the old CSRF value.

Apply two layers:

- API middleware checks every unsafe method (`POST`, `PUT`, `PATCH`, `DELETE`) for an exact allowed `Origin`; if `Origin` is absent, it accepts only a parseable `Referer` whose origin is exactly allowed. It rejects `Sec-Fetch-Site: cross-site` when Fetch Metadata is present. This layer also covers login and registration before a session exists.
- The current-session dependency additionally requires the session-bound custom header for unsafe authenticated routes. This includes logout, logout-all, conversations, messages, preferences, and uploads.

Requests without either `Origin` or an acceptable `Referer` fail closed. This is appropriate because FastAPI is the private backend of the web BFF in deployed environments. Safe methods do not mutate state. The implementation must inventory all routes to verify no state change uses `GET`.

Alternative considered: a readable double-submit CSRF cookie. Rejected because deriving the token from the server session avoids another cookie and directly binds rotation/revocation to CSRF validity.

Alternative considered: `SameSite` alone. Rejected because same-site policy is defense in depth, not a complete request-origin or CSRF proof.

### Centralize cookie policy and fail closed by environment

Replace `AUTH_TOKEN_SECRET` and `AUTH_TOKEN_EXPIRE_MINUTES` with session settings for idle minutes, absolute hours, touch interval, cookie name, `Secure`, `SameSite`, and the CSRF secret. Keep `Path=/` and no `Domain` as non-configurable invariants.

Use `SameSite=Lax`. Local/test may use `lookeate_session` without `Secure` for documented HTTP development. Staging/production require `__Host-lookeate_session`, `Secure=true`, HTTPS public/allowed origins, and a non-placeholder CSRF secret of at least 32 characters. Cookie issue and deletion go through one helper to guarantee matching attributes. `.env.example` documents values but contains no usable deployed secret.

Alternative considered: one `__Host-` cookie name in every environment. Rejected because compliant browsers require `Secure`, which breaks documented local HTTP use.

### Treat the Next.js route as a narrow security-aware BFF

Remove `Authorization` forwarding. Forward only required request headers: `Cookie`, `Content-Type`, `Accept`, `Origin`, `Referer`, `X-CSRF-Token`, and relevant `Sec-Fetch-*` headers. Continue using the configured private `API_BASE_URL` and never expose it to the browser.

Copy every upstream `Set-Cookie` field as a separate response header, including deletion cookies; do not comma-join cookie values. Tests must exercise multiple `Set-Cookie` headers because combined parsing is unsafe around `Expires`. Other hop-by-hop or arbitrary browser headers remain blocked.

Alternative considered: terminate sessions in Next.js. Rejected because it would duplicate identity and database logic and weaken FastAPI as the single actor/ownership authority.

### Restore frontend auth from the server only

Change auth state to `loading | authenticated | anonymous`; reserve `guest` for the later real guest identity. At startup, remove the legacy `digital-atelier-session` key once and call `/api/auth/session` with `credentials: "same-origin"`. Keep the returned user and CSRF value in React runtime state only.

Remove token fields from TypeScript auth contracts and token parameters from API functions. The shared request helper always uses same-origin credentials and adds `X-CSRF-Token` only for unsafe authenticated calls. A `401` clears runtime auth state; a `403` remains an authorization/CSRF error and does not masquerade as logout. `signOut` awaits logout and clears runtime state in a `finally` path so a lost network response cannot leave the UI falsely authenticated; server expiration remains the fallback if revocation could not reach the API.

Add Vitest with a DOM test environment and React Testing Library because the frontend currently has no test runner. Use mocked fetch for auth-provider and API-client behavior, and direct route-handler tests with mocked upstream fetch for the proxy. Do not add a full browser E2E dependency in this change.

### Add an additive, reversible Alembic revision

Create one revision after `20260814_0001` that creates only `auth_sessions` and its named constraints/indexes. Keep SQLAlchemy metadata aligned and avoid account-status or guest columns. Upgrade is additive and requires no backfill because bearer tokens are intentionally not migrated.

The downgrade drops only `auth_sessions`; losing active sessions is acceptable and forces reauthentication, while users, conversations, and preferences remain intact. Verify blank-to-head, baseline-to-head with representative existing data, downgrade/re-upgrade, metadata equivalence, and API startup at head on SQLite and ephemeral PostgreSQL. Normal API startup continues to perform no DDL.

Alternative considered: adding roadmap account type/status fields in the same revision. Rejected because guest identity and account lifecycle policy are explicitly out of scope and no current session behavior needs those fields.

## Risks / Trade-offs

- [Atomic cutover logs every browser out] -> Deploy the migration first, then API and frontend/proxy from the same release; remove legacy storage on first frontend initialization and communicate that users must sign in again.
- [A proxy cookie-forwarding bug can make all sessions unusable] -> Add route-handler tests for request cookies, issuance, deletion, and multiple `Set-Cookie` fields before cutover.
- [Idle touching creates database write load and concurrent updates] -> Throttle updates with the touch interval, use a single bounded update, and test that absolute expiry is never extended.
- [A stolen cookie remains usable until revocation or expiry] -> Use `HttpOnly`, `Secure`, host-only scope, `SameSite=Lax`, short idle expiry, absolute expiry, and server revocation; TLS remains mandatory in deployed environments.
- [XSS can read the CSRF value and issue same-origin requests] -> CSRF is not an XSS defense; keeping the auth token `HttpOnly` reduces credential theft, while separate CSP and XSS hardening remain necessary.
- [Logout cannot cancel a request already authenticated concurrently] -> Define revocation as authoritative for subsequent actor-resolution checks; sensitive future operations may add transaction-level revalidation if required.
- [No shared login rate limiter remains an abuse risk] -> Track it as a launch-blocking follow-up rather than introducing an unapproved infrastructure dependency in this session cutover.
- [Supporting direct non-browser API clients becomes harder] -> This contract intentionally serves the same-origin web BFF; a future public/mobile API must use a separately designed OAuth/OIDC surface.

## Migration Plan

1. Back up the target database and record the current application and Alembic revisions. Verify required session/CSRF settings without printing secret values.
2. Run focused migration checks on blank and baseline databases for SQLite and ephemeral PostgreSQL, including downgrade/re-upgrade and preserved non-session row counts.
3. Apply the additive `auth_sessions` revision as the single migration-owner release step before starting new API workers.
4. Deploy the API and frontend/proxy from the same release. The API stops accepting bearer tokens immediately; the frontend removes legacy storage and restores only cookie sessions.
5. Run smoke checks through the BFF for register, login, session restore, a protected mutation, logout replay rejection, login on two clients followed by logout-all, and cross-site/invalid-CSRF rejection.
6. Monitor non-sensitive counts of session creation and generic `401`/`403` outcomes. Never log cookie or CSRF values.

Forward repair is preferred after cutover. If application rollback is unavoidable, first deploy the prior compatible API and frontend together with its prior secret configuration, then downgrade the session revision only after confirming no new worker uses it. Downgrade invalidates all opaque sessions but preserves user-owned data. Do not run the old frontend against the new cookie-only API or the new frontend against the old bearer-only API.

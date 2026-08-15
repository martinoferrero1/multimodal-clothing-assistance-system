## Why

Lookeate currently exposes a stateless HMAC bearer credential to browser JavaScript and persists it in `localStorage`, so logout cannot revoke it and any script running in the origin can steal it. Before third-party beta use, web authentication needs a server-controlled session boundary with revocation, expiration, CSRF protection, and secure restoration through the existing Next.js proxy.

## What Changes

- **BREAKING** Replace browser-managed HMAC bearer authentication with opaque server-side sessions identified by an `HttpOnly` cookie; existing bearer tokens and browser-stored auth state will no longer authenticate web requests.
- Add an Alembic revision and aligned persistence model for hashed session tokens, server-enforced idle and absolute expiration, rotation, revocation, and minimized device metadata.
- Change login and registration to establish a session cookie without returning credentials, and add session restoration, logout, and logout-all endpoints.
- Resolve the current actor from the session on the server and reject expired, revoked, rotated, or replayed sessions.
- Protect cookie-authenticated state-changing requests with a session-bound CSRF token, allowed-origin checks, controlled `Referer` fallback, and Fetch Metadata checks where available.
- Forward `Cookie`, `Set-Cookie`, and approved CSRF headers through the same-origin Next.js proxy without exposing session credentials to frontend JavaScript.
- Restore frontend authentication from the session endpoint, remove auth credentials from Web Storage, and make sign-out revoke the server-side session.
- Add positive and negative backend, proxy, frontend, migration, and configuration tests for session lifecycle, cookie attributes, CSRF/origin enforcement, and credential removal.
- Keep guest identity, guest sessions, account recovery, and a user-facing session/device management screen out of scope.

## Capabilities

### New Capabilities
- `web-session-authentication`: Defines opaque cookie-based web sessions, server-side actor resolution, expiration, rotation and revocation, auth lifecycle endpoints, CSRF/origin defenses, proxy behavior, and frontend session restoration.

### Modified Capabilities
- `environment-configuration`: Requires explicit session lifetime, cookie, CSRF, and trusted web-origin configuration and fail-closed secure-cookie behavior in staging and production.

## Impact

- Affects FastAPI auth routes and dependencies, auth services, SQLAlchemy models, Alembic revisions, settings, and authenticated endpoint tests.
- Affects the Next.js API proxy, frontend auth provider, API client, route guards, login/registration flows, and logout controls.
- Adds an `auth_sessions` table and indexes while preserving existing users and application data; Alembic remains the only schema owner.
- Changes the web auth API contract and invalidates the legacy browser bearer flow without a compatibility period.
- Adds session and CSRF configuration to `.env.example` and runtime validation without introducing a new identity provider or guest behavior.

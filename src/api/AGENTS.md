# API instructions

## Contracts and authorization

- Keep request and response contracts explicit in schemas; do not silently change an approved API contract.
- Resolve the current actor through one shared dependency. Protected routes must authorize both actor state and resource ownership.
- Use `401` for absent or invalid authentication and `403` for an authenticated actor lacking permission. Avoid responses that enumerate registered emails.
- Keep route handlers orchestration-only; place reusable authentication, guest-promotion, and revocation behavior in services.

## Cookie-based session work

- Set and clear session cookies through centralized helpers so attributes stay identical across login, registration, promotion, rotation, and logout.
- Require CSRF validation for every cookie-authenticated state-changing endpoint; never perform a state change with `GET`.
- Preserve `Cookie`, `Set-Cookie`, origin, and CSRF behavior across the Next.js proxy and FastAPI boundary.
- Rotate or revoke the server-side session at every approved security boundary. Never return the raw opaque session token in a JSON response.

## API verification

- Test success, missing credentials, expired or revoked sessions, cross-user access, invalid CSRF, guest restrictions, and non-enumerating failures as applicable.
- Assert cookie attributes and deletion behavior, not only response status codes.

## Why

Lookeate already has a strong browser-session boundary, but its current web and image-processing surfaces still permit avoidable browser injection exposure, automated abuse, hostile multipart images, and server-side requests to unsafe catalog locations. These controls are needed before exposing staging or production to untrusted traffic, without reopening or duplicating the session and CSRF protections already delivered.

## What Changes

- Add centrally managed browser security headers to the Next.js BFF, including a safely staged CSP, `frame-ancestors`, `X-Content-Type-Options: nosniff`, Referrer Policy, Permissions Policy, and HSTS only when running behind confirmed staging or production HTTPS.
- Add endpoint-aware rate limits and abuse controls for login, registration, session restoration, Lookeate Assistant messages, and conversation image submissions, using a shared enforcement point in staging and production and deterministic local/test support.
- Harden the existing multipart conversation-image endpoint by validating image bytes rather than trusting filenames or declared MIME types, and by enforcing limits on attachment count, encoded size, dimensions, total pixels, animation, corruption, and decompression-bomb behavior.
- Harden catalog image downloads used by visual-similarity search against SSRF by validating scheme, DNS resolution and every connected IP, redirects, timeouts, response size, and actual image type, with safe fallback when a remote image is rejected or unavailable.
- Preserve the existing opaque revocable sessions, `HttpOnly` cookie lifecycle, CSRF token, Origin/Referer checks, Fetch Metadata checks, server-derived identity, and ownership enforcement; the new controls complement rather than replace or duplicate them.
- Exclude email verification, password recovery, MFA, guest mode, persistent upload storage, antivirus, quarantine, organizations, and marketplace behavior from this change.

## Capabilities

### New Capabilities
- `web-http-security`: Browser-facing HTTP security-header policy and environment-safe CSP/HSTS rollout at the Next.js BFF boundary.
- `api-abuse-protection`: Endpoint-specific rate limiting and abuse responses for authentication, session restoration, assistant messaging, and image submission.
- `conversation-image-upload-safety`: Byte-level validation and bounded decoding of multipart images submitted to Lookeate Assistant conversations.
- `remote-catalog-image-security`: SSRF-resistant, resource-bounded retrieval of remote catalog images with non-fatal visual-search fallback.

### Modified Capabilities

None.

## Impact

- Affects Next.js response configuration and the same-origin proxy, FastAPI authentication and conversation routes, image-analysis and visual-ranking services, runtime settings, deployment configuration, and focused backend/frontend tests.
- Introduces or formalizes a shared rate-limit backend for staging and production plus image inspection and guarded HTTP-fetch behavior; exact dependency choices remain implementation decisions.
- Adds environment contracts for CSP rollout, trusted HTTPS/HSTS activation, abuse-limit storage, upload budgets, and remote-fetch budgets while retaining local/test-safe defaults.
- Does not require a database schema change or persistent storage of submitted images.

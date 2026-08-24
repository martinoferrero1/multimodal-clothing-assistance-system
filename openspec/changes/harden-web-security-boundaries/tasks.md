## 1. Security Configuration Foundation

- [x] 1.1 Add validated backend settings for shared rate limiting, trusted BFF source forwarding, named endpoint budgets, aggregate upload/dimension/pixel/frame limits, and guarded remote-fetch schemes, redirects, deadlines, bytes, and MIME types.
- [x] 1.2 Add validated frontend server settings for CSP mode and explicit sources/reporting, trusted HTTPS termination, and bounded HSTS duration, with local/test HTTP-safe defaults and fail-closed staging/production rules.
- [x] 1.3 Update `.env.example`, dependency declarations, and Compose/deployment configuration with non-secret rate-limit service and web-security contracts; require a shared Redis-compatible backend in staging/production without introducing database DDL.
- [x] 1.4 Extend settings tests to prove accepted local/test configurations and rejection of missing shared enforcement, unsafe secrets, wildcard CSP sources, invalid report-only reporting, and inconsistent HTTPS/HSTS configuration in staging/production.

## 2. Shared API Abuse Protection

- [x] 2.1 Implement the rate-limit policy/result interface and deterministic in-memory local/test adapter with an injectable clock and atomic evaluation of multiple dimensions.
- [x] 2.2 Implement the Redis-compatible adapter with atomic multi-key consumption, TTL-bounded pseudonymous keys, bounded retry calculation, short operation timeouts, and no raw email, cookie, session token, or CSRF data in keys or logs.
- [x] 2.3 Add deployed startup/readiness validation for the shared limiter and stable `429` plus `Retry-After` and fail-closed `503` response handling.
- [x] 2.4 Make the Next.js BFF overwrite the private client-source header from only the configured trusted ingress signal, and make FastAPI reject or ignore browser-spoofed forwarding values outside the trusted BFF path.
- [x] 2.5 Apply source and HMAC-normalized account policies to login and registration before password hashing or writes, preserving identical public behavior for known and unknown accounts.
- [x] 2.6 Apply the source policy to session restoration before database lookup without changing session validation, cookie deletion, or `401` semantics.
- [x] 2.7 Apply server-derived user and source policies to text, streaming, and multipart Lookeate Assistant message routes, with the image route atomically consuming its additional image budget before body processing or downstream work.
- [x] 2.8 Add focused abuse tests for exhaustion/recovery, account and source key rotation, multiple simulated workers sharing state, spoofed forwarding headers, `Retry-After`, store failure, no expensive calls/writes after rejection, and unchanged CSRF/Origin/Fetch Metadata/ownership behavior.

## 3. Conversation Image Upload Safety

- [x] 3.1 Implement a reusable byte-level image inspector that detects supported formats, validates declared MIME compatibility, treats decompression-bomb warnings as errors, rejects truncation/corruption, and returns normalized metadata without persisting bytes.
- [x] 3.2 Enforce maximum width, height, per-frame and cumulative pixels, and frame count before downstream conversion, with a default one-frame animation policy and stable `413`, `415`, and `422` error mapping.
- [x] 3.3 Refactor multipart attachment reading to enforce count, bounded per-file bytes, aggregate bytes, and all-attachments-valid atomicity before base64 construction, conversation writes, provider calls, or visual search.
- [x] 3.4 Add generated and fixture-based tests for valid JPEG/PNG/WEBP/static GIF, MIME spoofing, unsupported bytes, mismatched type, zero/truncated/corrupt files, oversized count/individual/aggregate bytes, excessive dimensions/pixels, multi-frame animation, and decompression-bomb warnings.

## 4. SSRF-Safe Catalog Image Retrieval

- [x] 4.1 Implement strict catalog URL parsing and DNS/IP validation for configured HTTP schemes, rejecting userinfo, malformed authorities, and every non-public IPv4/IPv6 destination classification.
- [x] 4.2 Implement destination-pinned HTTP and HTTPS connections that preserve Host, SNI, and certificate hostname verification while bypassing ambient proxies, cookies, credentials, and unrelated request headers.
- [x] 4.3 Implement manual redirect handling that resolves relative locations, fully revalidates every hop, enforces a redirect cap, and maintains one monotonic total deadline plus bounded connect/read timeouts.
- [x] 4.4 Stream remote bodies under header and actual-byte limits, verify declared and detected image MIME through the bounded inspector, and return typed non-sensitive failure categories.
- [x] 4.5 Replace direct `urlopen` use in visual similarity with the guarded fetcher and preserve per-product skip plus semantic/text/structured fallback without logging full URLs or internal destination details.
- [x] 4.6 Add local fake-DNS/server tests for unsupported schemes, credentials, private/loopback/link-local/reserved IPv4 and IPv6, mixed DNS answers, rebinding resistance, safe and unsafe redirects, redirect loops, TLS hostname checks, timeouts, oversized/chunked bodies, MIME spoofing, corrupt images, stripped credentials, and all-fetches-fail fallback.

## 5. Browser HTTP Security Boundary

- [x] 5.1 Implement one server-only BFF security-policy builder for `nosniff`, strict referrer behavior, restrictive Permissions Policy, explicit `frame-ancestors`, and a deny-by-default CSP covering all required resource classes without deployed wildcard hosts.
- [x] 5.2 Add per-request CSP nonces compatible with Next.js rendering and emit exactly the report-only or enforced header selected from the same policy, requiring an observable HTTPS reporting destination for deployed report-only mode.
- [x] 5.3 Apply baseline headers to pages, static responses, and proxied API responses while preserving upstream status, content type, streaming bodies, and every separate `Set-Cookie` value.
- [x] 5.4 Emit HSTS only for validated staging/production HTTPS with explicit trusted termination, using a configurable short initial max-age and excluding `includeSubDomains` and `preload` from this change.
- [x] 5.5 Add frontend tests or executable response assertions for page/static/proxy headers, CSP mode and nonce behavior, framing denial, local HTTP without HSTS, deployed HSTS preconditions, and proxy cookie preservation.

## 6. Integrated Verification And Rollout Evidence

- [x] 6.1 Run focused backend security tests, then `APP_ENV=test PYTHONPATH=src python -m pytest tests/`, and resolve regressions without weakening existing session, CSRF, origin, Fetch Metadata, or ownership controls.
- [x] 6.2 Run frontend `npm run lint` and `npm run build`, then smoke a production build through the BFF for login, registration, session restoration, Lookeate Assistant text/stream/image flows, and visual-search fallback.
- [x] 6.3 Validate Compose/deployed startup with the shared limiter available and unavailable, confirm multiple API workers share budgets, and verify logs/metrics contain failure categories and counters but no secrets, raw account identifiers, cookies, or full sensitive URLs.
- [ ] 6.4 Deploy the intended CSP in staging report-only mode, record and resolve required-resource violations, then verify enforced staging behavior before production promotion; document the report-only rollback and HTTPS `Strict-Transport-Security: max-age=0` procedure.
- [x] 6.5 Run `openspec validate harden-web-security-boundaries --strict` and record final acceptance evidence for security headers, abuse rejection, malicious upload fixtures, SSRF destinations/redirects, safe fallback, and environment fail-closed behavior.

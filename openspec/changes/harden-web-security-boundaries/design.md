## Context

See `proposal.md` for motivation and the four delta specs for behavioral contracts. The browser currently reaches FastAPI only through the Next.js catch-all BFF, which already preserves cookies, CSRF and origin evidence. FastAPI centrally checks Origin/Referer and Fetch Metadata before unsafe requests, resolves opaque sessions through shared dependencies, and derives conversation ownership server-side.

The current gaps sit outside those established controls. Next.js has no response-header policy. Authentication and conversation routes have no shared abuse budget. Multipart uploads bound count and per-file bytes but trust the declared MIME type and do not inspect decoded image resources. Visual similarity uses synchronous `urllib.request.urlopen`, follows redirects implicitly, and reads bytes without destination or actual-MIME validation. `APP_ENV` already distinguishes local/test from staging/production and rejects insecure deployed identity settings.

## Goals / Non-Goals

**Goals:**

- Add controls at the earliest boundary that has enough trustworthy context, while keeping authentication, CSRF, and ownership logic authoritative and unchanged.
- Make every new budget explicit, configurable, fail-fast in deployed environments, and deterministic in tests.
- Reject hostile images before base64 construction, provider calls, visual feature extraction, or conversation writes.
- Prevent catalog fetching from connecting to non-public destinations even across DNS changes and redirects.
- Provide rollout and rollback paths for CSP and HSTS that do not break local HTTP development.

**Non-Goals:**

- Changing session credentials, cookie scope, CSRF semantics, origin policy, authorization, or account lifecycle.
- Building guest, email verification, recovery, MFA, persistent upload, malware scanning, quarantine, organization, or marketplace features.
- Creating a database-backed quota ledger, billing-grade quotas, permanent bans, or a general-purpose outbound HTTP proxy.
- Selecting a hosted Redis, CSP reporting, edge firewall, or observability vendor.

## Decisions

### 1. Emit browser controls from one BFF security-policy module

Create a server-only frontend policy module consumed by Next.js middleware/configuration so document, static, and `/api/proxy` responses receive the same baseline headers. Keep the catch-all proxy responsible only for faithfully transporting approved request headers and upstream response metadata; the security policy wraps its browser-facing response without merging `Set-Cookie` values.

The policy will set `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a deny-by-default Permissions Policy for capabilities Lookeate does not use. CSP will include at least `default-src`, `base-uri`, `object-src`, `frame-ancestors`, `script-src`, `style-src`, `img-src`, `font-src`, and `connect-src`; source additions must be explicit rather than wildcard host allowances. Per-request nonces will be used for executable inline script where required by Next.js instead of making `'unsafe-inline'` the deployed end state.

`CSP_MODE=report-only|enforce` will select exactly one header from the same policy builder. A deployed report-only configuration requires a configured HTTPS reporting destination so violations are operationally observable without choosing its provider here. Configuration tests will reject wildcard deployed sources and incompatible modes.

Alternative considered: configure all headers only in `next.config.ts`. This is simpler but cannot safely generate request-specific nonces and makes runtime rollout validation awkward. Alternative considered: emit headers from FastAPI. That misses Next.js pages and assets and assigns the public browser policy to a private upstream.

### 2. Gate HSTS on explicit, validated HTTPS deployment evidence

The BFF will emit HSTS only when all three conditions hold: `APP_ENV` is `staging` or `production`, `PUBLIC_APP_URL` is HTTPS, and `TRUSTED_HTTPS_TERMINATION=true`. Staging/production configuration must explicitly choose the flag; local/test responses never emit HSTS. Initial rollout uses a short configurable `max-age` without `includeSubDomains` or `preload`; those expansions require a later domain-wide decision.

Alternative considered: infer HTTPS solely from `X-Forwarded-Proto`. An attacker-controlled or incorrectly trusted forwarding header can produce false assurance, so it is insufficient without the deployment contract. Alternative considered: always emit HSTS in production. That can pin a misconfigured domain before HTTPS termination has been verified.

### 3. Enforce endpoint policies through a small rate-limit service

Add an API rate-limit service with named policies for login, registration, session restoration, text message, stream message, and image message. Each policy evaluates all applicable dimensions atomically before consuming them and returns an allow result or a bounded retry interval. Rejections use a stable `429` JSON contract plus `Retry-After`; shared-store failures use `503` and do not execute protected work.

Staging and production use a Redis-compatible service with an atomic script and TTL-bound keys. Local/test use an injected in-memory implementation with a controllable clock. The API startup readiness gate checks the shared backend in deployed environments. No rate-limit state enters PostgreSQL and no schema migration is needed.

Authentication policies combine a source key and an HMAC-derived normalized account key where an email is available; the HMAC uses a dedicated secret and never stores raw email in rate-limit keys. Assistant policies combine the authenticated server-derived user ID and source key. The image endpoint consumes both message and image policies. Successful and failed requests consume the applicable attempt budget, because counting only failures creates race and oracle problems.

The BFF will replace, not append, a private client-source header sent to FastAPI. It derives that value only from a deployment-configured trusted ingress header; when no trusted ingress is configured, it uses the direct request context/fallback source. FastAPI accepts this private header only from its configured BFF proxy path and otherwise derives the peer source itself. This prevents arbitrary browser `X-Forwarded-For` values from selecting limit keys.

Origin/Fetch Metadata middleware continues to run before route work. Login and registration limits run after parsing only the bounded credential schema but before password hashing or writes. Session restoration applies its source policy before database lookup. Assistant limits run after existing session/CSRF resolution, so user keys are server-derived, but before multipart reads, provider calls, or conversation writes.

Alternative considered: an in-process limiter in every environment. It is bypassed by multiple workers and loses state on restart. Alternative considered: enforce only at the BFF or CDN. That lacks reliable normalized account and authenticated actor dimensions and would make direct internal API safety depend entirely on one perimeter. Edge controls can still complement the API policy later.

### 4. Introduce a reusable bounded image inspector

Move upload validation from the route into an image-inspection service. The route will first enforce attachment count, bounded per-file reads, and aggregate encoded-byte limits. The inspector then detects the format from bytes, checks declared/detected MIME compatibility, opens the image with Pillow under an explicit pixel ceiling, inspects width, height and frame count, verifies each permitted frame's cumulative pixel budget, and performs structural verification by reopening the stream after `verify()`.

Pillow decompression-bomb warnings are promoted to errors inside a scoped warning context. Truncated-image compatibility flags are not enabled. The default animation policy is one frame, which preserves static GIF compatibility while rejecting animation; all supported formats and limits are settings validated as positive and internally consistent. Only after every attachment passes will the route create normalized attachment data and call the existing conversation service. Any failure rejects the complete request before persistence.

Use `413` for count, encoded-size, dimensions, and pixel-budget failures; `415` for unsupported or mismatched types and forbidden animation; and a stable `422` for supported-but-corrupt structure. Public responses do not include decoder internals.

Alternative considered: trust multipart MIME plus Pillow failure during downstream analysis. This allows polyglots and decompression bombs deeper into expensive code and produces inconsistent partial work. Alternative considered: re-encode every accepted upload. Re-encoding can reduce parser ambiguity but increases CPU and is unnecessary without persistent storage; bounded verification is the smaller control for this scope.

### 5. Replace implicit URL fetching with a destination-pinned catalog fetcher

Create a dedicated synchronous catalog-image fetcher for the existing synchronous visual-ranking path. It parses each URL, permits only explicitly configured `http` and `https`, rejects userinfo and malformed authorities, normalizes the host, resolves it with `getaddrinfo`, and rejects the request if any candidate address is non-public according to Python's IP classification plus explicit unspecified, multicast, reserved, loopback, link-local, and private checks.

The fetcher selects a validated address and connects directly to that IP. For HTTPS it wraps the socket with the original hostname as SNI and certificate-verification name; the HTTP `Host` header also remains the original normalized authority. This pins the connection to a validated address rather than resolving the hostname again inside a generic client. Ambient proxy variables, cookies, authorization, and inbound headers are not used.

Redirect following is manual. Each `Location` is resolved against the previous URL and passes the full validation again, with a small hop limit and one monotonic total deadline spanning DNS, connect, redirects, and reads. Connect/read socket deadlines remain bounded inside that total. Bodies are streamed in chunks and stopped at the byte ceiling, with early rejection from excessive `Content-Length` when present. The response must declare an allowed image MIME and pass the shared byte-level image inspector before feature extraction.

Fetch failures return a typed internal failure category. Visual ranking logs only category, product ID, and a digest/normalized host where appropriate, then skips that feature and preserves the existing semantic/text/structured fallback. Exceptions and full URLs are not logged because catalog URLs can contain sensitive query components.

Alternative considered: validate DNS and continue using `urlopen`. The library can resolve again at connection time and follows redirects implicitly, leaving DNS rebinding and redirect SSRF gaps. Alternative considered: allowlist current catalog hosts only. An allowlist is a useful optional restriction but does not replace public-IP checks and would make new catalog sources an operational deployment for every data change.

### 6. Extend the existing environment contract and evidence

Backend settings will add shared-store URL/readiness, a dedicated rate-key secret, trusted BFF source configuration, named rate policies, upload aggregate/dimension/pixel/frame limits, and remote-fetch scheme/redirect/connect/read/total/MIME limits. Frontend server settings will add CSP mode/sources/reporting, HTTPS-termination confirmation, and HSTS duration. `.env.example` documents safe local values and mandatory deployed values without secrets.

Configuration validation fails before traffic when staging/production lacks the shared limiter, dedicated secrets, CSP rollout mode/reporting prerequisites, or HTTPS/HSTS consistency. Tests inject local implementations and local HTTP defaults, so unrelated suites do not need Redis or external network access.

## Risks / Trade-offs

- [A strict CSP can break Next.js hydration or remote catalog imagery] -> Start with the exact enforcement policy in report-only mode, exercise production builds in staging, use nonces, and promote the same policy text to enforcement only after violations are understood.
- [HSTS persists in browsers beyond rollback] -> Begin with a short max-age, omit preload/includeSubDomains, verify HTTPS first, and support an HTTPS rollback response with `max-age=0`.
- [Distributed limits can reject legitimate users behind shared NAT] -> Use separate source and account/user dimensions with independently tuned budgets, bounded retry windows, and non-sensitive metrics before tightening values.
- [Fail-closed limiter outages reduce availability] -> Keep Redis readiness and runtime failure visible, use short operation timeouts, and return `503` rather than silently exposing login or costly model endpoints.
- [Source identity depends on correct proxy trust] -> Make trusted ingress/BFF configuration explicit, overwrite private forwarding headers at the BFF, keep FastAPI private in deployed environments, and test spoofed headers.
- [Image verification consumes CPU] -> Reject count and encoded sizes first, apply pixel/frame ceilings before full decode, keep limits conservative, and benchmark the largest accepted fixtures.
- [Low-level destination pinning is more code than a general HTTP client] -> Keep it isolated, cover IPv4/IPv6, TLS hostname validation, redirects, and timeout behavior with local fake servers, and expose only a narrow fetch-image operation.
- [Rejecting any DNS answer that is non-public may exclude unusual valid hosts] -> Prefer fail-closed SSRF behavior; catalog operators can correct image hosts rather than relaxing private-address protection.

## Migration Plan

1. Add settings, validation, non-secret examples, local/test adapters, and unit tests without enabling deployed enforcement.
2. Deploy the shared rate-limit dependency and readiness check, then enable endpoint policies in staging with metrics for allowed, rejected, and unavailable evaluations. Production deployment is blocked until all workers share state.
3. Deploy upload validation and guarded catalog fetching behind their existing endpoints/mode. Verify malicious fixtures and confirm visual search falls back when every fetch is rejected.
4. Deploy the BFF headers with the intended final CSP in report-only mode and HSTS disabled. Exercise login, session restoration, workspace navigation, Lookeate Assistant streaming, image messages, and remote product images using a production frontend build.
5. Enforce CSP in staging, then production after the observation window has no unexplained required-resource violations. Enable HSTS only after direct HTTPS and forwarded-protocol behavior are verified, starting with a short max-age.
6. Roll back CSP by returning to report-only with the same policy. Roll back rate limiting by deploying the previous application while keeping the shared store harmlessly available; do not configure deployed bypass. Roll back HSTS over HTTPS with `max-age=0`, recognizing previously cached policy remains until browsers receive that response or the old max-age expires.

No Alembic migration or data backfill is required.

---
name: lookeate-review-auth-security
description: Review Lookeate authentication and identity decisions and code involving login, registration, logout, cookies, server-side sessions, CSRF, password and email flows, guest users, guest promotion, authorization, ownership, rate limits, and security tests. Use before, during, or after identity work; do not use to author, approve, or automatically implement OpenSpec artifacts.
---

# Review Lookeate authentication security

Evaluate an identity change against Lookeate's trust boundaries and roadmap. Produce a decision-oriented review with concrete verification evidence.

## Respect the decision boundary

- Treat user-approved OpenSpec artifacts as scope input. Inspect them when relevant, but do not create, edit, approve, or mark them complete unless the user explicitly asks.
- Default to analysis and review. Modify code only when the user explicitly requests implementation.
- Read `documentation/identity_guest_environments_plan.md` for roadmap work. Treat its architecture as the current baseline and explain any proposed deviation.
- Separate technical security requirements from unresolved product policy such as retention duration, guest quotas, or verification timing.

## Follow the review workflow

1. Identify the change stage: proposed decision, approved design, implementation, or regression review.
2. Trace the complete request path: browser, Next.js proxy/BFF, FastAPI, service, and database.
3. Identify every actor and transition involved: anonymous, guest, member, and any privileged operator.
4. State the security invariants before evaluating implementation details.
5. Review threats, failure modes, and abuse cases.
6. Define the tests and runtime evidence needed to accept the decision.

## Enforce identity invariants

- Derive the current actor and ownership on the server. Never trust a client-provided user ID as authorization proof.
- Keep browser credentials out of `localStorage` and `sessionStorage`. Prefer an opaque, revocable server-side session in an `HttpOnly` cookie for the Lookeate web application.
- Store only a cryptographic hash of an opaque session token. Rotate sessions after login, registration, guest promotion, credential changes, and privilege changes.
- Revoke sessions on logout and enforce idle and absolute expiration on the server.
- Apply consistent cookie attributes: `HttpOnly`, explicit `SameSite`, `Path=/`, no `Domain`, and `Secure` plus a `__Host-` name in staging and production.
- Protect every cookie-authenticated state change with explicit CSRF controls. Review `Origin`, controlled `Referer` fallback, Fetch Metadata where available, and a session-bound custom-header token.
- Keep authentication errors non-enumerating. Hash passwords with an established password KDF and store verification or recovery tokens hashed, single-use, and expiring.
- Apply rate limits to login, registration, guest creation, verification, and recovery. Require a shared production enforcement point rather than an in-memory counter.
- Represent a guest as a limited server-side identity. Preserve ownership checks, define expiration and cleanup, and promote the same user identity transactionally when registering.
- Never log passwords, cookies, bearer values, recovery tokens, CSRF secrets, or raw session tokens.

## Require verification evidence

Cover the relevant positive and negative cases:

- valid, expired, revoked, rotated, and replayed sessions;
- missing or invalid CSRF token and cross-site requests;
- ownership attempts across two different users;
- anonymous, guest, and member route behavior;
- guest promotion preserving the user ID and owned data;
- duplicate-email and recovery flows without account enumeration;
- cookie creation and deletion attributes through the Next.js proxy;
- production configuration rejecting insecure cookie or secret settings.

Prefer focused tests first, then the applicable backend suite and frontend lint/build checks. Do not claim a control is complete without naming the test, command, or observable result that proves it.

## Return a decision review

Structure the result as:

1. **Scope and assumptions**
2. **Recommended decision** and why it fits Lookeate
3. **Alternatives considered** with tradeoffs
4. **Findings**, ordered by severity
5. **Acceptance evidence** still required or already observed
6. **Unresolved product decisions** that do not block the technical foundation

Format a code finding as `[severity] path:line - risk - recommendation - verification`. If no blocking finding exists, say so and identify residual risks.

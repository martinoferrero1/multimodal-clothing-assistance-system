## Purpose

Defines Lookeate's browser authentication boundary using opaque, revocable server-side sessions, secure cookies, request-forgery defenses, and credential-free frontend restoration.

## Requirements

### Requirement: Opaque server-side session credential
The system SHALL authenticate web users with a cryptographically random opaque session token carried only in an `HttpOnly` cookie, SHALL store only a cryptographic hash of that token, and SHALL NOT return or accept the legacy HMAC bearer credential for web authentication.

#### Scenario: Login establishes a session
- **WHEN** a member submits valid login credentials from an allowed web origin
- **THEN** the system creates a server-side session and sets its opaque token in an `HttpOnly` cookie
- **AND** the response contains no session token, bearer token, or other reusable authentication credential

#### Scenario: Registration establishes a session atomically
- **WHEN** a new member successfully registers from an allowed web origin
- **THEN** the member and initial session are committed atomically and the session cookie is set
- **AND** a failure to create either record leaves neither a partial member nor a usable session

#### Scenario: Legacy bearer credential is presented
- **WHEN** a request presents only a previously issued HMAC bearer credential
- **THEN** the system returns `401` and does not authenticate an actor

#### Scenario: Session storage is inspected
- **WHEN** persisted session rows are examined
- **THEN** no raw session token or reusable browser credential is present

### Requirement: Secure session cookie lifecycle
The session cookie SHALL use `HttpOnly`, an explicit `SameSite` policy, `Path=/`, and no `Domain`; it SHALL additionally use `Secure` and a `__Host-` cookie name in staging and production. Cookie deletion SHALL use matching scope and security attributes.

#### Scenario: Session cookie is issued in staging or production
- **WHEN** authentication succeeds in staging or production
- **THEN** the response sets a `Secure`, `HttpOnly`, `SameSite` session cookie with a `__Host-` name, `Path=/`, and no `Domain`

#### Scenario: Session cookie is issued for documented local HTTP development
- **WHEN** authentication succeeds in a permitted local HTTP environment
- **THEN** the response sets an `HttpOnly`, explicitly `SameSite` session cookie with `Path=/` and no `Domain` using the documented local cookie name

#### Scenario: Session ends
- **WHEN** the current session is logged out, revoked, expired, or rejected as invalid
- **THEN** the response clears the browser cookie using attributes that match the issued cookie's scope

### Requirement: Server-enforced session expiration
Each session SHALL have server-enforced idle and absolute expiration times. A request SHALL be authenticated only while the session is unrevoked, before both expiration times, and associated with an eligible member account; client clocks SHALL NOT determine validity.

#### Scenario: Active session is used
- **WHEN** a valid unrevoked session is used before its idle and absolute expiration times
- **THEN** the system authenticates its member and advances activity within the configured idle-expiration policy without extending absolute expiration

#### Scenario: Idle timeout has elapsed
- **WHEN** a session token is presented after its idle expiration time
- **THEN** the system returns `401`, does not authenticate an actor, and the session cannot become valid through later use

#### Scenario: Absolute timeout has elapsed
- **WHEN** a session token is presented after its absolute expiration time regardless of recent activity
- **THEN** the system returns `401`, does not authenticate an actor, and the session cannot become valid through later use

### Requirement: Session rotation and replay rejection
The system SHALL replace rather than reuse a session credential at authentication boundaries, including successful login and registration when a session credential is already present. The replaced session SHALL be revoked before the replacement becomes usable.

#### Scenario: Authenticated browser logs in again
- **WHEN** a browser with an existing valid session successfully logs in
- **THEN** the existing session is revoked and a new opaque session cookie is issued

#### Scenario: Replaced token is replayed
- **WHEN** a session token that was replaced through rotation is presented again
- **THEN** the system returns `401` and does not authenticate an actor

#### Scenario: Rotation cannot complete
- **WHEN** creation of the replacement session fails
- **THEN** the system does not expose a partially created replacement credential and preserves a transactionally consistent session state

### Requirement: Session restoration endpoint
The system SHALL provide `GET /api/auth/session` to derive the current actor from the session cookie and return credential-free actor data plus a CSRF value bound to that session.

#### Scenario: Valid session is restored
- **WHEN** the browser requests the session endpoint with a valid session cookie
- **THEN** the response returns the current member representation and a CSRF value usable only with that session
- **AND** it does not return the opaque session token

#### Scenario: Session cannot be restored
- **WHEN** the session endpoint receives no cookie or an invalid, expired, revoked, or rotated session token
- **THEN** it returns `401` without revealing which validation failed

### Requirement: Current-session logout
The system SHALL provide `POST /api/auth/logout` to revoke the current valid session and clear its cookie. Reuse of the revoked token SHALL fail even if the browser cookie value was captured before logout.

#### Scenario: Member logs out
- **WHEN** an authenticated member submits a valid protected logout request
- **THEN** the current session is revoked, the cookie is cleared, and the response contains no credential

#### Scenario: Logged-out token is replayed
- **WHEN** the revoked session token is manually replayed after logout
- **THEN** the system returns `401` and does not authenticate an actor

### Requirement: Logout from all sessions
The system SHALL provide `POST /api/auth/logout-all` to revoke every active session belonging to the current member, including the current session, and clear the current browser cookie.

#### Scenario: Member logs out everywhere
- **WHEN** an authenticated member submits a valid protected logout-all request
- **THEN** all of that member's active sessions are revoked and the current cookie is cleared

#### Scenario: Another member has active sessions
- **WHEN** one member logs out from all sessions
- **THEN** sessions belonging to every other member remain unchanged

#### Scenario: Any former session is replayed
- **WHEN** any session token revoked by logout-all is presented
- **THEN** the system returns `401` and does not authenticate an actor

### Requirement: CSRF and request-origin protection
The system SHALL protect every cookie-authenticated state-changing request with an allowed `Origin` or controlled `Referer` fallback, same-site Fetch Metadata when supplied by the browser, and a custom-header CSRF value cryptographically bound to the current session. Authentication state changes that begin without a session SHALL still require an allowed origin and acceptable Fetch Metadata.

#### Scenario: Legitimate state-changing request
- **WHEN** a same-origin browser submits a state-changing request with a valid session cookie, allowed origin evidence, acceptable Fetch Metadata, and the matching session-bound CSRF header
- **THEN** the request proceeds to authentication and authorization

#### Scenario: CSRF header is missing or invalid
- **WHEN** a cookie-authenticated state-changing request omits the CSRF header or presents a value not bound to the current session
- **THEN** the system returns `403` without performing the state change

#### Scenario: Cross-site request is submitted
- **WHEN** a state-changing request has a disallowed origin, a disallowed controlled `Referer` fallback, or Fetch Metadata identifying it as cross-site
- **THEN** the system returns `403` without performing the state change even if the session cookie and CSRF value are otherwise valid

#### Scenario: Browser omits Origin
- **WHEN** a state-changing request has no `Origin` but has an allowed, parseable `Referer` and otherwise valid protections
- **THEN** the request may proceed

#### Scenario: Origin evidence is absent
- **WHEN** a state-changing request has neither an `Origin` nor an allowed controlled `Referer` fallback
- **THEN** the system returns `403` without performing the state change

#### Scenario: Login is attempted cross-site
- **WHEN** login or registration is submitted with disallowed origin evidence or cross-site Fetch Metadata
- **THEN** the system returns `403`, creates no session, and does not change account state

### Requirement: Server-derived identity and non-enumerating failures
Protected operations SHALL derive the member identity from the validated session and SHALL NOT accept a client-provided user identifier as authorization proof. Authentication failures SHALL not reveal whether an email, session, or member account exists.

#### Scenario: Member attempts cross-user access
- **WHEN** one authenticated member requests or mutates resources owned by another member
- **THEN** the system denies access regardless of any user identifier supplied by the client

#### Scenario: Login credentials are invalid
- **WHEN** login uses an unknown email or an incorrect password
- **THEN** both cases return the same public authentication failure contract

#### Scenario: Invalid session variants are presented
- **WHEN** a malformed, unknown, expired, revoked, or rotated session token is presented
- **THEN** all variants use the same public `401` contract and no secret value is logged

### Requirement: Same-origin proxy preserves security headers
The Next.js proxy SHALL forward browser cookies, approved origin and CSRF request headers, and every upstream `Set-Cookie` value needed by the session lifecycle without exposing the opaque token to application JavaScript.

#### Scenario: Browser request crosses the proxy
- **WHEN** a browser sends a session-authenticated request through the same-origin proxy
- **THEN** the proxy forwards the cookie and approved CSRF, origin, referer, and Fetch Metadata headers to the API

#### Scenario: API issues or deletes cookies
- **WHEN** the API response contains one or more `Set-Cookie` headers
- **THEN** the proxy preserves each cookie header separately in the browser response

#### Scenario: Upstream response has no session cookie
- **WHEN** the API response does not set or delete a cookie
- **THEN** the proxy does not synthesize a session credential

### Requirement: Frontend restores sessions without stored credentials
The frontend SHALL determine authentication by calling the session endpoint with same-origin credentials, SHALL keep the CSRF value only in runtime memory, and SHALL NOT persist session tokens, bearer tokens, CSRF values, or complete auth sessions in `localStorage` or `sessionStorage`.

#### Scenario: Application starts with a valid cookie
- **WHEN** the frontend initializes and the session endpoint succeeds
- **THEN** the interface enters the authenticated state using the returned member and keeps the returned CSRF value only in memory

#### Scenario: Application starts without a valid cookie
- **WHEN** the frontend initializes and the session endpoint returns `401`
- **THEN** the interface enters the anonymous state without relying on browser-stored credentials

#### Scenario: Legacy browser auth state exists
- **WHEN** the frontend encounters the legacy stored auth-session key
- **THEN** it removes that value and never uses its bearer token as a fallback credential

#### Scenario: Authenticated request becomes unauthorized
- **WHEN** an authenticated frontend request returns `401`
- **THEN** runtime member and CSRF state are cleared and the interface transitions to anonymous

#### Scenario: Frontend signs out
- **WHEN** a member activates sign out
- **THEN** the frontend awaits the protected logout request and clears runtime auth state without writing credentials to Web Storage

### Requirement: Commercial session context is bounded and revocable
The system SHALL bind a selected commercial store context only to an opaque server-side session after server-side membership validation. It SHALL rotate the session when commercial context is selected or ownership privileges materially change, and SHALL revoke sessions bound to a store when that store is rejected, suspended, or loses the current owner's eligible membership.

#### Scenario: Store context changes
- **WHEN** an eligible member selects a different active store
- **THEN** the system revokes the prior session before issuing a replacement session bound to the newly selected store
- **AND** replay of the prior session cannot authorize either store

#### Scenario: Store privilege is removed
- **WHEN** a store-bound owner session is affected by suspension, rejection, membership revocation, or ownership transfer
- **THEN** the system revokes that session and clears its cookie when it is next presented

### Requirement: Session restoration exposes only safe commercial status
The session-restoration response SHALL return only the current human representation, session-bound CSRF value, and the server-derived selected-store status required by the browser. It SHALL NOT expose another store's membership, authorization details, session credential, or MFA secret.

#### Scenario: Pending owner restores a session
- **WHEN** a prospective owner restores a valid session bound to a pending store
- **THEN** the response identifies the pending commercial status needed for onboarding
- **AND** it does not authorize commercial operations

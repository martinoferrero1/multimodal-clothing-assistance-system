## Purpose

Defines resource-aware abuse controls for Lookeate's authentication and assistant APIs while preserving stable authentication, session, and request-forgery semantics.

## Requirements

### Requirement: Sensitive and expensive endpoints have distinct abuse budgets
The system SHALL enforce separately configurable rate-limit policies for login, registration, session restoration, Lookeate Assistant text-message submission, streaming message submission, and multipart image-message submission. Image submissions SHALL be subject to both message and image-specific budgets.

#### Scenario: Request remains within its budget
- **WHEN** an eligible request is within every applicable endpoint budget
- **THEN** rate limiting permits normal authentication, authorization, CSRF, validation, and business processing to continue

#### Scenario: Authentication budget is exhausted
- **WHEN** login, registration, or session restoration exceeds an applicable budget
- **THEN** the system returns `429` with a bounded `Retry-After` value and performs no authentication or session state change

#### Scenario: Assistant budget is exhausted
- **WHEN** a text, streaming, or image message exceeds an applicable budget
- **THEN** the system returns `429` before invoking image analysis, model providers, visual search, or conversation writes

### Requirement: Limit keys resist simple evasion without trusting client identity
Unauthenticated authentication limits SHALL include a server-derived source dimension and, where an account identifier is supplied, a normalized non-reversible account dimension. Authenticated assistant limits SHALL include the server-derived user identity and a source dimension. Client-supplied forwarding headers SHALL affect source identity only when received through an explicitly trusted proxy path.

#### Scenario: Invalid passwords rotate for one account
- **WHEN** repeated login attempts target the same normalized account from changing source addresses
- **THEN** the account-scoped budget can reject the attempts without revealing whether the account exists

#### Scenario: One source rotates account identifiers
- **WHEN** one source repeatedly targets different login or registration identifiers
- **THEN** the source-scoped budget can reject the attempts

#### Scenario: Forwarding header comes from an untrusted peer
- **WHEN** a request supplies a forwarded client address outside the configured trusted proxy path
- **THEN** the system ignores that header when deriving the rate-limit source

### Requirement: Rejection responses do not weaken existing security boundaries
Rate-limit enforcement SHALL preserve non-enumerating authentication responses and SHALL NOT replace or bypass session validation, cookie handling, CSRF, Origin/Referer, Fetch Metadata, server-derived identity, or resource ownership checks.

#### Scenario: Unknown and known accounts are limited
- **WHEN** equivalent login attempts for an unknown account and a known account exceed the same policy
- **THEN** both receive the same public rate-limit contract

#### Scenario: Limited request also has invalid CSRF evidence
- **WHEN** a request is rejected by an abuse budget and would also fail an existing request-forgery control
- **THEN** no state change or expensive downstream work occurs
- **AND** no response detail discloses session, account, or ownership state

### Requirement: Deployed enforcement is shared and fail-closed
Staging and production SHALL use a shared rate-limit enforcement point across API workers. A protected endpoint SHALL NOT silently run without its required enforcement when that shared dependency is unavailable; local and test MAY use an isolated deterministic implementation.

#### Scenario: Requests reach different production workers
- **WHEN** related requests are handled by multiple production API workers
- **THEN** every worker observes the same consumed abuse budget

#### Scenario: Shared enforcement is unavailable
- **WHEN** staging or production cannot evaluate a required abuse policy
- **THEN** the protected endpoint returns a temporary service failure without performing its operation

#### Scenario: Test uses deterministic enforcement
- **WHEN** an automated test runs without external infrastructure
- **THEN** it can exercise window exhaustion and recovery deterministically without contacting a deployed rate-limit service

### Requirement: Commercial identity flows have independent abuse budgets
The system SHALL enforce separately configurable rate-limit policies for store registration, store email verification, TOTP enrollment confirmation, and store approval operations. The public policies SHALL include a server-derived source dimension and normalized non-reversible email and store-identifier dimensions where submitted; the approval policy SHALL additionally include the authenticated operator dimension.

#### Scenario: Store registration budget is exhausted
- **WHEN** a source, email, or store-identifier dimension exceeds the store-registration policy
- **THEN** the system returns `429` with a bounded `Retry-After`
- **AND** it creates no user, store, membership, token, MFA credential, or session

#### Scenario: Verification attempts are exhausted
- **WHEN** repeated store verification or MFA confirmation attempts exceed their applicable policy
- **THEN** the system returns the generic rate-limit contract without disclosing whether a registration, token, or MFA factor exists

### Requirement: Commercial rate-limit outcomes are observable without PII
The system SHALL record structured, non-sensitive outcomes for allowed, rejected, and unavailable commercial identity rate-limit checks, separated by policy. Staging and production SHALL fail closed when the shared enforcement point required by a commercial identity policy is unavailable.

#### Scenario: Shared production limiter is unavailable
- **WHEN** a production store-registration or approval request cannot reach its required shared rate-limit enforcement
- **THEN** the system returns a temporary service failure before changing commercial identity state

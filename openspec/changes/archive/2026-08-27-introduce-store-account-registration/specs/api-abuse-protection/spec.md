## ADDED Requirements

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

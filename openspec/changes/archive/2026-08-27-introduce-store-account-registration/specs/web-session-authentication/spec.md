## ADDED Requirements

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

## Purpose

Defines server-derived, membership-based tenant authorization for Lookeate commercial capabilities and prevents access across store boundaries.

## Requirements

### Requirement: Commercial context is server-derived
The system SHALL derive the active store from the validated opaque session and resolve the current user's membership from server-side data. A client-provided `store_id`, handle, user identifier, role, or lifecycle state SHALL NOT establish commercial authorization.

#### Scenario: Client supplies another store identifier
- **WHEN** an authenticated user submits a commercial request containing a store identifier for a different store
- **THEN** the system evaluates authorization against the session's active store context
- **AND** it denies the request when the server-derived membership is absent or ineligible

### Requirement: Store selection is explicit and validated
The system SHALL provide a protected state-changing operation to select a store context. It SHALL select only an active store for which the current human identity has an active owner membership, rotate the session before the selected context becomes usable, and not treat selection input as authorization proof.

#### Scenario: Eligible owner selects a store
- **WHEN** an authenticated owner selects a store where it has an active owner membership and the store is active
- **THEN** the system rotates the opaque session and records that store as the server-side active context

#### Scenario: User selects an ineligible store
- **WHEN** an authenticated user attempts to select a store without an eligible active membership
- **THEN** the system returns `403` and does not change the active store context or session

### Requirement: Shared dependency enforces commercial roles and state
Every commercial endpoint SHALL use a common server-side authorization dependency that requires a valid session, an active selected store, an active membership, the required role, verified owner email, and a verified MFA factor. An absent or invalid session SHALL return `401`; an authenticated but ineligible actor or tenant SHALL return `403` without revealing another store's data.

#### Scenario: User lacks a membership
- **WHEN** an authenticated human identity with no membership invokes a commercial endpoint
- **THEN** the system returns `403` and performs no commercial action

#### Scenario: Active owner invokes a commercial endpoint
- **WHEN** an owner with a valid selected active store, verified email, and verified MFA invokes an endpoint requiring `owner`
- **THEN** the common dependency supplies the server-derived commercial context to the endpoint

### Requirement: Privilege changes revoke affected store sessions
Rejecting or suspending a store, revoking its owner membership, or transferring ownership SHALL revoke sessions whose active store is affected before the revoked context can authorize another request. Sessions not bound to the affected store SHALL retain only the independently valid personal or other-store access for which they remain eligible.

#### Scenario: Suspended owner reuses a store-bound session
- **WHEN** an owner presents a session bound to a store that has been suspended
- **THEN** the system returns `401` or `403` according to session validity and does not authorize commercial access

#### Scenario: Owner of another store remains eligible
- **WHEN** a person who owns two stores has one store suspended
- **THEN** the affected store-bound session is revoked
- **AND** the person can establish a separate eligible context for the unaffected active store

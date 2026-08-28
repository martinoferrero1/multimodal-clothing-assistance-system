## Purpose

Defines Lookeate's commercial tenant identity so human accounts can safely own and manage one or more independently governed stores.

## Requirements

### Requirement: Store identity contains required commercial data
The system SHALL represent each store separately from its human owners and SHALL require its legal name, public display name, unique public handle, jurisdiction, tax or business registration identifier, business address, store contact email, and store contact phone before it can be submitted. A store SHALL have exactly one lifecycle state: `pending`, `active`, `rejected`, or `suspended`.

#### Scenario: Store is submitted with complete data
- **WHEN** a registration supplies all required valid commercial fields
- **THEN** the system creates a distinct store in the `pending` state
- **AND** the public handle and jurisdiction-plus-business-identifier combination are unique

#### Scenario: Store data is incomplete or conflicts
- **WHEN** a registration omits a required commercial field or conflicts with an existing unique store identifier
- **THEN** the system does not create or alter a store
- **AND** its public response does not disclose whether the conflicting store already exists

### Requirement: Membership separates human identity from store tenancy
The system SHALL keep `ChatUser` as the human identity and SHALL associate it with stores through StoreMembership records. A membership SHALL identify one store, one user, its role, creation time, and revocation state; a user MAY hold memberships in multiple stores.

#### Scenario: One owner administers multiple stores
- **WHEN** a verified human identity has eligible memberships in two active stores
- **THEN** it can establish a server-authorized commercial context for either store
- **AND** activity in one context does not grant access to the other without its separate membership

### Requirement: Initial ownership is singular and auditable
The only StoreMembership role initially available SHALL be `owner`. Each store SHALL have exactly one active owner, and creation, transfer, revocation, suspension, and restoration of ownership SHALL create an audit event identifying the actor, affected store, action, and timestamp without recording secrets.

#### Scenario: Ownership is transferred
- **WHEN** an authorized ownership-transfer procedure names an eligible receiving human identity
- **THEN** the system atomically revokes the prior active ownership and establishes the recipient as the sole active owner
- **AND** it records the ownership-change audit event

#### Scenario: Owner is revoked without a replacement
- **WHEN** an operation attempts to revoke the only active owner without completing a replacement transfer or suspending the store
- **THEN** the system rejects the operation and preserves the existing ownership

### Requirement: Store lifecycle controls commercial eligibility
A store SHALL remain `pending` until its owner has verified the registration email, enrolled and completed the required MFA step-up, and an authorized platform approver activates it. `rejected` and `suspended` stores SHALL not have commercial privileges; a rejected store SHALL not become active without a new approval decision, and a suspended store SHALL require an explicit restoration decision.

#### Scenario: All activation prerequisites are complete
- **WHEN** the pending store has email verification, an enrolled verified owner MFA factor, and an approval decision
- **THEN** the system transitions the store to `active`

#### Scenario: Store is suspended or rejected
- **WHEN** an authorized platform approver suspends or rejects a store
- **THEN** the store immediately loses commercial eligibility
- **AND** its store-bound sessions and active commercial memberships cannot authorize further commercial requests

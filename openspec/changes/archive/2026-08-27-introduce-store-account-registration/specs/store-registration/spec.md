## Purpose

Defines the secure public flow that establishes a Lookeate store and makes its owner eligible for commercial access only after verification, MFA, and approval.

## ADDED Requirements

### Requirement: Store registration is public but transactionally complete
The system SHALL provide `POST /api/auth/store/register` for anonymous registration of a store. A successful submission SHALL atomically create a new human consumer identity, pending store, and active owner membership, or create none of them; it SHALL not create a browser session until email verification succeeds.

#### Scenario: New store registration succeeds
- **WHEN** an anonymous visitor submits valid owner credentials and required store data
- **THEN** the system commits the new user, pending store, and owner membership as one transaction
- **AND** it sends an email-verification challenge without returning a session credential

#### Scenario: Registration transaction fails
- **WHEN** creation of the user, store, membership, or verification challenge cannot complete
- **THEN** the system rolls back every record created for that attempt
- **AND** it issues no session cookie

### Requirement: Registration does not enumerate existing identities or stores
Equivalent store-registration attempts with a duplicate email, public handle, or jurisdiction-plus-business-identifier SHALL return the same public success-acknowledgement contract as a newly accepted submission. The system SHALL not issue a session or indicate which submitted identifier caused the conflict.

#### Scenario: Existing email is submitted
- **WHEN** a visitor submits a store registration using an email already held by a human identity
- **THEN** the response matches the generic registration acknowledgement
- **AND** no store, membership, or session is created for that attempt

#### Scenario: Existing store identity is submitted
- **WHEN** a visitor submits a store registration using an existing public handle or business identifier
- **THEN** the response matches the generic registration acknowledgement
- **AND** the existing store remains unchanged

### Requirement: Guests cannot become store owners automatically
The public store-registration endpoint SHALL reject an existing guest identity as an implicit owner-promotion path. A guest SHALL not gain store ownership, retain a store-registration session, or have its identity converted through this endpoint.

#### Scenario: Guest submits store registration
- **WHEN** a browser with a guest session submits a store registration
- **THEN** the system does not promote the guest or create commercial records for that guest
- **AND** it returns the same non-enumerating public acknowledgement contract

### Requirement: Email verification is secret-safe and one-time
The system SHALL issue a random verification value for the registration email, store only its cryptographic hash, enforce a short configured expiration, and record one successful consumption at most once. The verification value SHALL be submitted by a same-origin `POST` request and SHALL NOT be persisted in Web Storage or issued as a reusable URL credential.

#### Scenario: Valid verification is completed
- **WHEN** the prospective owner submits an unexpired unused verification value for the pending registration
- **THEN** the system marks the email verified, consumes the value, creates a store-bound opaque session, and returns only the normal cookie and credential-free actor response

#### Scenario: Expired or reused verification is submitted
- **WHEN** a verification value is expired, unknown, or already consumed
- **THEN** the system makes no account, store, membership, or session state change
- **AND** it returns a generic verification failure that does not disclose the value's history

### Requirement: Owner MFA and approval gate activation
After email verification, a prospective owner SHALL enroll a TOTP authenticator and successfully confirm a current code before it is MFA-eligible. A platform approver SHALL activate a pending store only after the email and MFA prerequisites are met; an approval before either prerequisite SHALL leave the store pending.

#### Scenario: MFA is enrolled and approval follows
- **WHEN** the verified prospective owner successfully confirms a current TOTP code and an authorized approver activates the store
- **THEN** the store becomes active and its owner can establish commercial access

#### Scenario: Approval is attempted before prerequisites
- **WHEN** a platform approver attempts to activate a store whose owner has not verified email or MFA
- **THEN** the activation is rejected
- **AND** the store remains pending without commercial privileges

### Requirement: Commercial registration endpoints retain web security controls
All store registration, verification, MFA, selection, status, and approval endpoints SHALL preserve the existing same-origin BFF, cookie, Origin or Referer, Fetch Metadata, and CSRF protections applicable to their authentication state. State-changing endpoints SHALL use `POST`, `PATCH`, or `DELETE`, and no response SHALL expose passwords, verification values, MFA secrets, session tokens, or CSRF values beyond the session-bound value already returned by the session contract.

#### Scenario: Cross-site verification request is submitted
- **WHEN** a cross-site request attempts to submit a verification value or mutate store status
- **THEN** the system rejects it before changing state

## Purpose

Defines Lookeate's browser onboarding for personal accounts and store registration without exposing credentials or obscuring commercial activation status.

## ADDED Requirements

### Requirement: Personal and commercial registration are distinct choices
The anonymous Lookeate onboarding SHALL present "Crear cuenta personal" and "Registrar una tienda" as separate actions. The store flow SHALL collect and validate the required owner and commercial data before submitting it through the same-origin BFF.

#### Scenario: Visitor chooses personal registration
- **WHEN** a visitor selects "Crear cuenta personal"
- **THEN** the interface uses the personal-account registration flow
- **AND** it does not request commercial data

#### Scenario: Visitor chooses store registration
- **WHEN** a visitor selects "Registrar una tienda"
- **THEN** the interface shows the commercial registration fields and validation errors without submitting invalid data

### Requirement: Onboarding communicates activation state safely
The store flow SHALL provide dedicated status surfaces for pending email verification, pending MFA enrollment, pending approval, rejection, suspension, and active commercial access. Rejection and suspension surfaces SHALL give a safe status and support path without exposing platform approval notes or another store's data.

#### Scenario: Registration awaits email verification
- **WHEN** a store registration acknowledgement is received
- **THEN** the interface displays the pending-verification state and accepts the emailed verification value only for same-origin submission

#### Scenario: Owner restores a pending store session
- **WHEN** a verified prospective owner restores a session for a pending store
- **THEN** the interface displays the outstanding MFA or approval state
- **AND** it does not render commercial controls

#### Scenario: Store is rejected or suspended
- **WHEN** the session status identifies the selected store as rejected or suspended
- **THEN** the interface renders the corresponding status surface and removes commercial controls

### Requirement: Browser identity and verification data are not persisted
The frontend SHALL rely on the server-issued HttpOnly session cookie and in-memory CSRF value. It SHALL NOT store passwords, session credentials, CSRF values, verification values, MFA secrets, provisioning images, or complete authentication state in `localStorage`, `sessionStorage`, browser-readable cookies, URLs, or client logs.

#### Scenario: User refreshes after entering sensitive onboarding data
- **WHEN** the browser refreshes during verification or MFA enrollment
- **THEN** the application reloads only server-derived session and store status
- **AND** the previously entered sensitive value is not recovered from browser persistence

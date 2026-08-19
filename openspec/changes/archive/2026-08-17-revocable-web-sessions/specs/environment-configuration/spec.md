## MODIFIED Requirements

### Requirement: Fail-closed staging and production configuration
The system SHALL reject staging and production configuration that uses SQLite; omits a required public application URL, allowed host, or allowed origin; uses a CSRF binding secret that is missing, shorter than 32 characters, a placeholder or example value, or a known development secret; or permits a session cookie without the required deployed security attributes. Staging and production SHALL use PostgreSQL database URLs.

#### Scenario: Production rejects development database
- **WHEN** `APP_ENV` is `production` and the application database URL uses SQLite
- **THEN** configuration loading fails before the API serves requests

#### Scenario: Staging rejects an unsafe secret
- **WHEN** `APP_ENV` is `staging` and the CSRF binding secret is absent, a placeholder or example value, or a known development value
- **THEN** configuration loading fails without logging the secret

#### Scenario: Deployed environments reject a short secret
- **WHEN** `APP_ENV` is `staging` or `production` and the CSRF binding secret is shorter than 32 characters
- **THEN** configuration loading fails without logging the secret

#### Scenario: Production rejects incomplete HTTP identity
- **WHEN** `APP_ENV` is `production` and the public application URL, allowed hosts, or allowed origins are missing or invalid
- **THEN** configuration loading fails and identifies the invalid setting without exposing secret values

#### Scenario: Valid production configuration is accepted
- **WHEN** `APP_ENV` is `production`, PostgreSQL is configured, required URL/host/origin values are valid, session-cookie settings are secure, and the CSRF binding secret is non-default
- **THEN** configuration loading succeeds

### Requirement: Documented non-secret environment contract
The repository SHALL provide a complete example environment file that contains no real secrets, lists the supported settings in scope, and identifies environment-specific database, session, cookie, CSRF, URL, host, origin, and provider requirements and development-only defaults.

#### Scenario: Developer prepares local configuration
- **WHEN** a developer consults the example environment file
- **THEN** the file identifies `APP_ENV`, database, session lifetimes, cookie policy, CSRF binding secret, public URL, allowed host/origin, and provider configuration expectations without containing usable credentials

#### Scenario: Operator prepares staging or production configuration
- **WHEN** an operator consults the example environment file for staging or production
- **THEN** development-only values are clearly marked as invalid and every fail-closed setting is documented

## ADDED Requirements

### Requirement: Explicit web session configuration
The system SHALL configure idle and absolute session lifetimes, activity-update cadence, cookie policy, allowed web origins, and CSRF binding independently from the removed legacy bearer-token settings. Absolute lifetime SHALL exceed idle lifetime, and configuration errors SHALL fail before requests are served.

#### Scenario: Valid session configuration loads
- **WHEN** all required session durations, cookie policy, allowed origins, and CSRF binding settings are internally consistent for the selected environment
- **THEN** configuration loading succeeds without retaining a legacy bearer-token requirement

#### Scenario: Session lifetimes are inconsistent
- **WHEN** the absolute session lifetime is not greater than the idle lifetime or an activity-update cadence could bypass the idle policy
- **THEN** configuration loading fails with a non-sensitive validation error

#### Scenario: CSRF binding secret is unsafe in a deployed environment
- **WHEN** staging or production omits the CSRF binding secret or configures a placeholder, known development value, or insufficiently strong value
- **THEN** configuration loading fails without exposing the secret

### Requirement: Fail-closed deployed cookie configuration
Staging and production SHALL reject any configuration that permits an insecure session cookie, a non-`__Host-` session cookie name, a cookie domain, a path other than `/`, or an origin that is not an allowed HTTPS web origin.

#### Scenario: Production cookie is insecure
- **WHEN** production configuration disables the session cookie's `Secure` attribute
- **THEN** configuration loading fails before the API serves requests

#### Scenario: Staging cookie scope is invalid
- **WHEN** staging configuration supplies a cookie domain, a path other than `/`, or a session cookie name without the `__Host-` prefix
- **THEN** configuration loading fails before the API serves requests

#### Scenario: Deployed allowed origin is not HTTPS
- **WHEN** staging or production configures a non-HTTPS allowed web origin
- **THEN** configuration loading fails before the API serves requests

#### Scenario: Documented local HTTP cookie is configured
- **WHEN** local configuration uses the documented non-`__Host-`, non-secure cookie policy with valid local session lifetimes and origins
- **THEN** configuration loading succeeds without weakening staging or production validation

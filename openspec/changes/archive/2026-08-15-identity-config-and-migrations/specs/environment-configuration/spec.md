## Purpose

Defines predictable, fail-closed runtime configuration for Lookeate across local, test, staging, and production environments without exposing secrets or making tests depend on external providers.

## ADDED Requirements

### Requirement: Explicit application environment
The system SHALL require `APP_ENV` to resolve to exactly one of `local`, `test`, `staging`, or `production`, and SHALL reject any other value before serving requests.

#### Scenario: Supported environment starts
- **WHEN** configuration declares one of the four supported environment values and satisfies that environment's requirements
- **THEN** configuration loading succeeds with that environment explicitly identified

#### Scenario: Unknown environment is rejected
- **WHEN** configuration declares an unsupported `APP_ENV` value
- **THEN** configuration loading fails with a non-sensitive validation error before the API serves requests

### Requirement: Fail-closed staging and production configuration
The system SHALL reject staging and production configuration that uses SQLite, omits a required public application URL, allowed host, or allowed origin, or uses an authentication secret that is missing, shorter than 32 characters, a placeholder or example value, or a known development secret. Staging and production SHALL use PostgreSQL database URLs.

#### Scenario: Production rejects development database
- **WHEN** `APP_ENV` is `production` and the application database URL uses SQLite
- **THEN** configuration loading fails before the API serves requests

#### Scenario: Staging rejects an unsafe secret
- **WHEN** `APP_ENV` is `staging` and the authentication secret is absent, a placeholder or example value, or a known development value
- **THEN** configuration loading fails without logging the secret

#### Scenario: Deployed environments reject a short secret
- **WHEN** `APP_ENV` is `staging` or `production` and the authentication secret is shorter than 32 characters
- **THEN** configuration loading fails without logging the secret

#### Scenario: Production rejects incomplete HTTP identity
- **WHEN** `APP_ENV` is `production` and the public application URL, allowed hosts, or allowed origins are missing or invalid
- **THEN** configuration loading fails and identifies the invalid setting without exposing secret values

#### Scenario: Valid production configuration is accepted
- **WHEN** `APP_ENV` is `production`, PostgreSQL is configured, required URL/host/origin values are valid, and required secrets are non-default
- **THEN** configuration loading succeeds

### Requirement: Required provider readiness during deployed startup
In staging and production, the system SHALL validate during application startup that every provider required by the active application configuration is correctly configured and available. The API SHALL NOT serve requests unless each required provider passes its readiness check, and failures SHALL identify the provider without exposing credentials or other secret values.

#### Scenario: Required providers are ready
- **WHEN** `APP_ENV` is `staging` or `production` and every provider required by the active configuration passes its startup readiness check
- **THEN** provider readiness does not prevent the API from serving requests

#### Scenario: A required provider is unavailable
- **WHEN** `APP_ENV` is `staging` or `production` and a required provider has incomplete configuration, cannot initialize, or fails its availability check
- **THEN** startup fails before the API serves requests and reports the affected provider without exposing secret values

### Requirement: Local and test development allowances
The system SHALL permit documented local and test values, including SQLite where supported, while keeping those allowances invalid in staging and production.

#### Scenario: Local SQLite configuration is accepted
- **WHEN** `APP_ENV` is `local` and a valid local SQLite database URL is configured
- **THEN** configuration loading succeeds without weakening staging or production validation

#### Scenario: Test configuration avoids external credentials
- **WHEN** `APP_ENV` is `test` and a test does not exercise an LLM, embedding, or image-analysis provider
- **THEN** settings can load and the test can run without real provider API keys or external network access

#### Scenario: Provider use still validates credentials
- **WHEN** a test or runtime path selects and initializes an external provider
- **THEN** the provider-specific model and credential requirements are validated before that provider is used

### Requirement: Documented non-secret environment contract
The repository SHALL provide a complete example environment file that contains no real secrets, lists the supported settings in scope, and identifies environment-specific requirements and development-only defaults.

#### Scenario: Developer prepares local configuration
- **WHEN** a developer consults the example environment file
- **THEN** the file identifies `APP_ENV`, database, authentication secret, public URL, allowed host/origin, and provider configuration expectations without containing usable credentials

#### Scenario: Operator prepares staging or production configuration
- **WHEN** an operator consults the example environment file for staging or production
- **THEN** development-only values are clearly marked as invalid and every fail-closed setting is documented

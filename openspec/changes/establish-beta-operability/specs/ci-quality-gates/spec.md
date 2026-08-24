## Purpose

Defines the reproducible verification gates that every Lookeate change must pass before its delivery artifact can be promoted.

## ADDED Requirements

### Requirement: Required change verification gates
The repository SHALL run backend tests, frontend lint and production build checks, migration verification, and security scans as required CI gates for changes affecting the application.

#### Scenario: All gates pass
- **WHEN** a change is evaluated in CI and every required check succeeds
- **THEN** CI SHALL publish a successful verification result associated with the exact commit

#### Scenario: A required gate fails
- **WHEN** any required check fails or cannot run
- **THEN** CI SHALL fail the change and SHALL NOT mark its artifact eligible for promotion

### Requirement: Reproducible verification environment
CI SHALL run required checks from a clean checkout using pinned or explicitly bounded tool and service versions, without relying on developer-local state or real provider credentials.

#### Scenario: Clean verification runs
- **WHEN** CI starts from a clean checkout
- **THEN** it SHALL provision documented dependencies and produce the same gate categories without undeclared local inputs

#### Scenario: External credentials are unavailable
- **WHEN** a gate does not require an external provider and provider credentials are absent
- **THEN** the gate SHALL still run using local fixtures, mocks, or disposable services

### Requirement: Migration and security checks are blocking
Migration upgrade, downgrade or recovery verification required by the supported database contract, dependency or code security scans, and secret-detection checks SHALL be blocking gates.

#### Scenario: Migration verification cannot provision its database
- **WHEN** the disposable database or container runtime is unavailable
- **THEN** CI SHALL report the prerequisite failure and SHALL fail the gate rather than skip it

#### Scenario: Security scan reports a finding above the configured threshold
- **WHEN** a security scan finds a disallowed vulnerability, secret, or policy violation
- **THEN** CI SHALL fail before artifact publication or promotion

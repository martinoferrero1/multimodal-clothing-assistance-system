## Purpose

Defines post-deployment smoke checks that prove a Lookeate environment is reachable, correctly configured, and serving its browser-facing contract.

## ADDED Requirements

### Requirement: Smoke tests cover public service boundaries
The deployment process SHALL run smoke tests against the deployed frontend and API boundary, including health, authentication-safe routing, core application loading, and configured security headers.

#### Scenario: Deployment is healthy
- **WHEN** the deployed endpoints respond within configured limits and required headers and routes are present
- **THEN** smoke tests SHALL pass and record the tested artifact digest and environment

#### Scenario: Deployment is unhealthy
- **WHEN** a required endpoint, route, header, or response behavior fails
- **THEN** smoke tests SHALL fail promotion or trigger rollback according to the deployment policy

### Requirement: Smoke tests do not expose credentials
Smoke tests SHALL use disposable test identities or non-sensitive probes and SHALL redact credentials, cookies, tokens, and response secrets from their output.

#### Scenario: Authenticated behavior is checked
- **WHEN** a smoke test needs an authenticated request
- **THEN** it SHALL use an explicitly provisioned disposable identity and securely clean up or expire its credentials

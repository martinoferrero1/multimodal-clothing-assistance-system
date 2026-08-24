## Purpose

Defines the operational signals and lifecycle behavior needed to run Lookeate safely and measure initial beta reliability.

## ADDED Requirements

### Requirement: Liveness and readiness are distinct
The service SHALL expose a liveness check for process health and a readiness check that confirms required runtime dependencies and migration state are usable.

#### Scenario: Healthy service is queried
- **WHEN** the process is alive and required dependencies are ready
- **THEN** liveness and readiness SHALL return successful, non-sensitive responses

#### Scenario: A required dependency is unavailable
- **WHEN** the process is alive but a dependency or migration prerequisite is unavailable
- **THEN** liveness MAY remain successful while readiness SHALL fail and traffic SHALL not be routed to the instance

### Requirement: Graceful shutdown drains requests
The service SHALL stop accepting new work during shutdown, allow in-flight requests up to a bounded grace period to finish, and close resources before exit.

#### Scenario: Shutdown begins during active traffic
- **WHEN** an instance receives a termination signal
- **THEN** it SHALL enter draining state and complete or cancel in-flight work according to the documented timeout

#### Scenario: Shutdown exceeds the grace period
- **WHEN** in-flight work does not finish before the timeout
- **THEN** the service SHALL exit and SHALL emit a structured shutdown outcome without exposing secrets

### Requirement: Requests produce correlated structured telemetry
The API SHALL emit structured logs and basic metrics for requests, errors, latency, health state, and dependency failures, with a propagated request or trace identifier and without sensitive values.

#### Scenario: Request completes
- **WHEN** a request crosses the public API boundary
- **THEN** its response and structured log context SHALL use a request or trace identifier

#### Scenario: Sensitive data is present
- **WHEN** logs or metrics are generated for an authenticated or provider-backed request
- **THEN** passwords, tokens, cookie values, secrets, and provider credentials SHALL be excluded

### Requirement: Beta reliability targets are measurable
The deployment documentation SHALL define initial availability, latency, error-rate, and recovery targets with the measurements and evidence needed to evaluate them.

#### Scenario: Beta review is performed
- **WHEN** an operator reviews a beta period
- **THEN** the recorded telemetry SHALL support comparison with each initial target and identify missing evidence

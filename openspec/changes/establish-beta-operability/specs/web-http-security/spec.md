## MODIFIED Requirements

### Requirement: HSTS is limited to confirmed deployed HTTPS
The BFF SHALL emit HTTP Strict Transport Security only in staging or production when the public application origin is HTTPS and the deployment explicitly confirms that browser traffic reaches the service through trusted HTTPS termination. It SHALL NOT emit HSTS for local or test HTTP operation. Production promotion SHALL additionally require recorded staging evidence that the selected CSP and HSTS behavior was observed and valid.

#### Scenario: Production HTTPS is confirmed
- **WHEN** Lookeate runs in production with an HTTPS public origin, trusted HTTPS termination is enabled, and staging security evidence is approved
- **THEN** browser-facing responses include the configured HSTS policy

#### Scenario: Local HTTP development is used
- **WHEN** Lookeate runs locally over HTTP
- **THEN** responses do not include HSTS

#### Scenario: Deployed HSTS preconditions conflict
- **WHEN** HSTS is enabled without a staging or production environment, an HTTPS public origin, or trusted HTTPS termination
- **THEN** configuration is rejected before the web service serves traffic

#### Scenario: Staging security evidence is missing
- **WHEN** a production promotion lacks approved staging evidence for CSP and HSTS behavior
- **THEN** promotion SHALL be rejected before production traffic is changed

### Requirement: Content Security Policy supports controlled rollout
The system SHALL support an explicit CSP report-only mode and an enforced mode using the same centrally defined policy. The policy SHALL default to denying unlisted resource origins and SHALL explicitly constrain framing, scripts, styles, images, connections, objects, and base URIs to the minimum sources required by Lookeate. The staging rollout SHALL capture policy violation evidence before enforcement or production promotion.

#### Scenario: Report-only rollout is selected
- **WHEN** an environment selects CSP report-only mode
- **THEN** responses contain `Content-Security-Policy-Report-Only` with the intended policy and violations are observable

#### Scenario: Enforcement is selected
- **WHEN** an environment selects enforced CSP mode and staging evidence has been reviewed
- **THEN** responses contain an enforced `Content-Security-Policy` header and supporting browsers block undeclared resources

#### Scenario: CSP configuration is invalid
- **WHEN** a deployed environment omits its required CSP mode or configures sources that violate the documented deployed policy
- **THEN** the web service fails configuration validation before serving traffic

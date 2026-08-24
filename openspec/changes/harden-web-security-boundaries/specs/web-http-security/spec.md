## Purpose

Defines browser-facing HTTP response protections for Lookeate and a controlled rollout that does not enable HTTPS-only behavior in local HTTP development.

## ADDED Requirements

### Requirement: Browser security headers are applied at the public BFF boundary
The public Next.js BFF SHALL apply a consistent security-header policy to application pages, static responses, and proxied API responses. The policy SHALL include `X-Content-Type-Options: nosniff`, an explicit Referrer Policy, a restrictive Permissions Policy, and clickjacking protection through CSP `frame-ancestors`.

#### Scenario: Application page is returned
- **WHEN** the browser receives a Lookeate application page
- **THEN** the response includes the configured browser security headers
- **AND** `frame-ancestors` prevents unapproved sites from embedding the page

#### Scenario: API response crosses the BFF
- **WHEN** FastAPI returns a response through the same-origin proxy
- **THEN** the browser-facing response retains the BFF security-header policy without losing upstream status, content type, or separate `Set-Cookie` values

### Requirement: Content Security Policy supports controlled rollout
The system SHALL support an explicit CSP report-only mode and an enforced mode using the same centrally defined policy. The policy SHALL default to denying unlisted resource origins and SHALL explicitly constrain framing, scripts, styles, images, connections, objects, and base URIs to the minimum sources required by Lookeate.

#### Scenario: Report-only rollout is selected
- **WHEN** an environment selects CSP report-only mode
- **THEN** responses contain `Content-Security-Policy-Report-Only` with the intended policy
- **AND** policy violations are observable without the browser blocking the request

#### Scenario: Enforcement is selected
- **WHEN** an environment selects enforced CSP mode
- **THEN** responses contain an enforced `Content-Security-Policy` header
- **AND** resources outside the declared policy are blocked by supporting browsers

#### Scenario: CSP configuration is invalid
- **WHEN** a deployed environment omits its required CSP mode or configures sources that violate the documented deployed policy
- **THEN** the web service fails configuration validation before serving traffic

### Requirement: HSTS is limited to confirmed deployed HTTPS
The BFF SHALL emit HTTP Strict Transport Security only in staging or production when the public application origin is HTTPS and the deployment explicitly confirms that browser traffic reaches the service through trusted HTTPS termination. It SHALL NOT emit HSTS for local or test HTTP operation.

#### Scenario: Production HTTPS is confirmed
- **WHEN** Lookeate runs in production with an HTTPS public origin and trusted HTTPS termination is enabled
- **THEN** browser-facing responses include the configured HSTS policy

#### Scenario: Local HTTP development is used
- **WHEN** Lookeate runs locally over HTTP
- **THEN** responses do not include HSTS

#### Scenario: Deployed HSTS preconditions conflict
- **WHEN** HSTS is enabled without a staging or production environment, an HTTPS public origin, or trusted HTTPS termination
- **THEN** configuration is rejected before the web service serves traffic

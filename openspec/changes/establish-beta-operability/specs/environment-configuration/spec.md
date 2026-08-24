## MODIFIED Requirements

### Requirement: Fail-closed staging and production configuration
The system SHALL reject staging and production configuration that uses SQLite; omits a required public application URL, allowed host, or allowed origin; uses a CSRF binding secret that is missing, shorter than 32 characters, a placeholder or example value, or a known development secret; permits a session cookie without the required deployed security attributes; or omits the explicit delivery and observability settings required by the deployment contract. Staging and production SHALL use PostgreSQL database URLs and SHALL not inherit local or development configuration implicitly.

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

#### Scenario: Production rejects an insecure session cookie
- **WHEN** `APP_ENV` is `production` and the session cookie does not satisfy the deployed security policy
- **THEN** configuration loading fails before requests are served

#### Scenario: Staging rejects missing operational configuration
- **WHEN** staging lacks the required artifact identity, health-check, or telemetry configuration
- **THEN** deployment validation fails before the service serves traffic

#### Scenario: Deployed configuration omits operational identity
- **WHEN** staging or production lacks the required artifact identity, health-check, or telemetry configuration
- **THEN** deployment validation fails before the service serves traffic

#### Scenario: Valid production configuration is accepted
- **WHEN** `APP_ENV` is `production`, PostgreSQL is configured, required URL/host/origin values are valid, session-cookie settings are secure, the CSRF binding secret is non-default, and delivery and observability settings are complete
- **THEN** configuration loading succeeds

### Requirement: Required provider readiness during deployed startup
In staging and production, the system SHALL validate during application startup that every provider required by the active application configuration is correctly configured and available. The API SHALL NOT serve requests unless each required provider passes its readiness check, and failures SHALL identify the provider without exposing credentials or other secret values.

#### Scenario: Required providers are ready
- **WHEN** `APP_ENV` is `staging` or `production` and every provider required by the active configuration passes its startup readiness check
- **THEN** provider readiness does not prevent the API from serving requests

#### Scenario: A required provider is unavailable
- **WHEN** `APP_ENV` is `staging` or `production` and a required provider has incomplete configuration, cannot initialize, or fails its availability check
- **THEN** startup fails before the API serves requests and reports the affected provider without exposing secret values

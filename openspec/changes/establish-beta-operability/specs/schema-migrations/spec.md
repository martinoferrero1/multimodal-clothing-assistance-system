## MODIFIED Requirements

### Requirement: Recoverable migration releases
Each migration revision SHALL include a safe downgrade when practical; otherwise it SHALL document why downgrade is unsafe and define backup/restore or forward-recovery steps before release. Release verification SHALL exercise the selected recovery path and record the resulting database revision.

#### Scenario: Reversible revision is tested
- **WHEN** a revision has a safe downgrade
- **THEN** a disposable database can upgrade, downgrade, and re-upgrade without unexpected data loss

#### Scenario: Forward-only revision is reviewed
- **WHEN** a revision cannot safely downgrade
- **THEN** its release procedure identifies backup, restore, application compatibility, and forward-recovery requirements before it is applied

#### Scenario: Forward-only baseline downgrade aborts safely
- **WHEN** an operator attempts to downgrade the forward-only baseline toward `base`
- **THEN** the downgrade aborts before issuing destructive DDL and leaves the application schema, existing data, and recorded revision unchanged

#### Scenario: Migration recovery evidence is missing
- **WHEN** a release has not produced the required migration recovery evidence
- **THEN** the release SHALL NOT be eligible for staging or production promotion

### Requirement: Reproducible ephemeral PostgreSQL verification
The repository SHALL provide a documented command backed by Docker Compose and a version-pinned PostgreSQL image that reproducibly provisions an isolated ephemeral PostgreSQL database, waits for readiness, runs the mandatory PostgreSQL migration and adoption tests, and removes the ephemeral resources after the run. If PostgreSQL cannot be provisioned or reached, the command and mandatory tests SHALL fail explicitly with an actionable error rather than skip silently or report success. The same verification SHALL be callable as a blocking CI gate.

#### Scenario: PostgreSQL verification runs from a clean checkout
- **WHEN** a developer or CI runner with the documented container prerequisite invokes the PostgreSQL verification command
- **THEN** it provisions an isolated PostgreSQL instance, waits until it is ready, runs the blank-upgrade and legacy-adoption verification, and cleans up the ephemeral resources even when a test fails

#### Scenario: PostgreSQL provisioning is unavailable
- **WHEN** the container runtime, PostgreSQL service, or required connection cannot be made available
- **THEN** PostgreSQL verification fails with an actionable setup error and no mandatory PostgreSQL case is silently skipped or reported as passing

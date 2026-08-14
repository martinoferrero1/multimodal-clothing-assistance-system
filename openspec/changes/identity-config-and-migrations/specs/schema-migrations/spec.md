## Purpose

Defines versioned, explicit, and data-preserving schema evolution for Lookeate so blank and existing databases can reach a known revision without application processes executing DDL.

## ADDED Requirements

### Requirement: Versioned schema authority
The system SHALL use versioned migrations as the only supported mechanism for creating or changing application-owned database schema in deployed and developer databases.

#### Scenario: Blank database is initialized
- **WHEN** the migration upgrade command runs against a blank supported database
- **THEN** it creates the complete current application schema and records the head revision

#### Scenario: A future schema change is introduced
- **WHEN** application-owned tables, columns, constraints, or indexes change
- **THEN** the change is represented by a new ordered migration revision rather than runtime DDL

### Requirement: Explicit migration execution
Database migrations SHALL run as an explicit setup or release step owned by one migration process, and normal API workers SHALL NOT create, alter, drop, stamp, or upgrade schema during startup.

#### Scenario: API starts on a migrated database
- **WHEN** the API starts against a database at the required migration revision
- **THEN** startup performs no schema-changing statements and the API can serve requests

#### Scenario: API starts on an unmigrated or outdated database
- **WHEN** the API starts against a database that is blank, unversioned, or behind the required migration revision
- **THEN** startup fails with a clear non-sensitive instruction to run the migration step and performs no DDL

#### Scenario: Multiple API workers start together
- **WHEN** multiple API workers start against a migrated database
- **THEN** none competes to mutate or version the schema

### Requirement: Existing database adoption preserves data
The migration process SHALL provide a documented, explicit adoption path for an existing unversioned database created by the legacy startup behavior. Adoption SHALL verify that the legacy schema matches the baseline before stamping it and SHALL preserve existing rows.

#### Scenario: Compatible legacy database is adopted
- **WHEN** an operator follows the adoption procedure on a legacy database whose application-owned schema matches the baseline
- **THEN** the baseline revision is recorded without recreating tables or changing existing row counts, and subsequent upgrades can run normally

#### Scenario: Drifted legacy database is rejected
- **WHEN** the adoption check finds missing, extra, or incompatible required schema objects
- **THEN** it refuses to stamp the database, reports the mismatch, and leaves schema and data unchanged

#### Scenario: Versioned existing database is upgraded
- **WHEN** the upgrade command runs against a database at an earlier known revision
- **THEN** ordered revisions upgrade it to head while preserving data unless a reviewed revision explicitly documents otherwise

### Requirement: Supported database compatibility
Migrations SHALL support PostgreSQL for staging and production and the SQLite usage promised for local and test, with dialect-specific behavior explicitly handled and verified.

#### Scenario: Blank PostgreSQL upgrade
- **WHEN** migrations run from an empty PostgreSQL database to head
- **THEN** all application-owned tables, constraints, indexes, defaults, and nullability match the model contract

#### Scenario: Blank SQLite upgrade
- **WHEN** migrations run from an empty SQLite database to head for local or test use
- **THEN** the resulting application-owned schema is usable by the same application models within documented dialect differences

### Requirement: Recoverable migration releases
Each migration revision SHALL include a safe downgrade when practical; otherwise it SHALL document why downgrade is unsafe and define backup/restore or forward-recovery steps before release.

#### Scenario: Reversible revision is tested
- **WHEN** a revision has a safe downgrade
- **THEN** a disposable database can upgrade, downgrade, and re-upgrade without unexpected data loss

#### Scenario: Forward-only revision is reviewed
- **WHEN** a revision cannot safely downgrade
- **THEN** its release procedure identifies backup, restore, application compatibility, and forward-recovery requirements before it is applied

#### Scenario: Forward-only baseline downgrade aborts safely
- **WHEN** an operator attempts to downgrade the forward-only baseline toward `base`
- **THEN** the downgrade aborts before issuing destructive DDL and leaves the application schema, existing data, and recorded revision unchanged

### Requirement: Reproducible ephemeral PostgreSQL verification
The repository SHALL provide a documented command backed by Docker Compose and a version-pinned PostgreSQL image that reproducibly provisions an isolated ephemeral PostgreSQL database, waits for readiness, runs the mandatory PostgreSQL migration and adoption tests, and removes the ephemeral resources after the run. If PostgreSQL cannot be provisioned or reached, the command and mandatory tests SHALL fail explicitly with an actionable error rather than skip silently or report success.

#### Scenario: PostgreSQL verification runs from a clean checkout
- **WHEN** a developer or CI runner with the documented container prerequisite invokes the PostgreSQL verification command
- **THEN** it provisions an isolated PostgreSQL instance, waits until it is ready, runs the blank-upgrade and legacy-adoption verification, and cleans up the ephemeral resources even when a test fails

#### Scenario: PostgreSQL provisioning is unavailable
- **WHEN** the container runtime, PostgreSQL service, or required connection cannot be made available
- **THEN** PostgreSQL verification fails with an actionable setup error and no mandatory PostgreSQL case is silently skipped or reported as passing

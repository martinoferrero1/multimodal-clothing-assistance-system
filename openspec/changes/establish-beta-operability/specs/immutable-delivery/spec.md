## Purpose

Defines how Lookeate builds become traceable, immutable delivery artifacts that can be promoted consistently from staging to production.

## ADDED Requirements

### Requirement: Commit-addressed artifacts
Each deployable backend and frontend artifact SHALL be identified by the source commit, build metadata, and content digest, and SHALL be reproducible from the same source revision.

#### Scenario: A verified commit is packaged
- **WHEN** all CI gates pass for a commit
- **THEN** the system SHALL publish artifacts whose metadata identifies that commit and whose digests are recorded

#### Scenario: An unverified commit is packaged
- **WHEN** required gates have not passed for a commit
- **THEN** the delivery process SHALL refuse to publish a promotable artifact

### Requirement: Promotion reuses the staging artifact
Production promotion SHALL deploy the exact artifact digest that passed staging verification and SHALL record the promotion and rollback target.

#### Scenario: Staging verification succeeds
- **WHEN** the commit-addressed staging deployment passes smoke tests and required evidence checks
- **THEN** production promotion SHALL be allowed only for that same digest

#### Scenario: Artifact digest differs
- **WHEN** a production deployment references a digest different from the verified staging digest
- **THEN** promotion SHALL be rejected before traffic is changed

### Requirement: Development and deployed configuration are separated
Development configuration SHALL remain convenient for local use, while staging and production configuration SHALL be explicit, fail closed, and shall not inherit development secrets or unsafe defaults.

#### Scenario: Local stack starts with development settings
- **WHEN** a developer selects the documented local configuration
- **THEN** the local stack SHALL use only local/test allowances and SHALL not alter deployed validation rules

#### Scenario: Deployed configuration is incomplete
- **WHEN** staging or production lacks a required deployment setting
- **THEN** startup or deployment validation SHALL fail before serving traffic

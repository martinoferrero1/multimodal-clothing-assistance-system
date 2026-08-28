## ADDED Requirements

### Requirement: Commercial identity schema evolves with explicit integrity controls
The migration introducing commercial identity SHALL add versioned schema for stores, store memberships, one-time verification records, verified owner MFA credentials, and store-bound session context. It SHALL use named foreign keys, unique constraints, lifecycle or role checks, and query indexes that enforce unique store identity, one membership per user-store pair, and no more than one active owner per store across supported database dialects.

#### Scenario: Commercial schema is upgraded on a blank database
- **WHEN** a blank supported database is upgraded to the revision containing commercial identity
- **THEN** it contains the commercial tables, columns, constraints, and indexes required to enforce store isolation and ownership

### Requirement: Existing users remain consumer identities without synthetic tenancy
The commercial identity migration SHALL preserve every existing `ChatUser` and its related rows, classify existing human accounts as consumers where an account-kind marker is required, and SHALL NOT create a store or StoreMembership merely to backfill a consumer. The migration SHALL be deterministic and restart-safe if it performs data updates.

#### Scenario: Existing database is upgraded
- **WHEN** the migration runs against a database populated before commercial identity
- **THEN** pre-existing user and related-row counts are preserved
- **AND** no synthetic store membership grants commercial access to an existing user

### Requirement: Commercial migration recovery is release-ready
The commercial identity revision SHALL provide a safe downgrade when its added schema can be removed without data loss; otherwise it SHALL be forward-only and document backup, restore, and forward-recovery steps before release. The selected recovery path SHALL be exercised on a disposable PostgreSQL database and a supported SQLite local or test database.

#### Scenario: Recovery path is exercised
- **WHEN** the commercial identity migration is verified before release
- **THEN** the documented downgrade or forward-recovery path reaches a known usable revision without silently discarding commercial or pre-existing user data

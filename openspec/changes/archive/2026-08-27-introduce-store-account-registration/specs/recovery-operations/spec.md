## ADDED Requirements

### Requirement: Commercial identity data is included in operational recovery
Lookeate backup, restore, and recovery procedures SHALL include stores, memberships, ownership audit events, verification-token metadata, MFA credential material, and store-bound sessions. Procedures SHALL preserve encryption and access controls for MFA material and SHALL not place raw verification values or session credentials in backups, logs, or recovery records.

#### Scenario: Commercial restore drill runs
- **WHEN** an operator restores a backup containing commercial identity data into an isolated environment
- **THEN** the restored application can resolve store ownership and lifecycle state consistently
- **AND** the drill records duration, integrity results, and any reconciliation required

### Requirement: Ownership transfer has a controlled recovery procedure
Operations documentation SHALL define how authorized personnel verify a transfer request, perform or recover an atomic ownership transfer, revoke affected store sessions, and record the security event. The procedure SHALL prevent an operator from leaving an active store without an owner unless the store is suspended as part of the same controlled action.

#### Scenario: Owner loses access to MFA
- **WHEN** the sole owner cannot complete MFA and a transfer is authorized through the documented procedure
- **THEN** operations transfer ownership to the verified replacement or suspend the store
- **AND** sessions bound to the prior ownership are revoked

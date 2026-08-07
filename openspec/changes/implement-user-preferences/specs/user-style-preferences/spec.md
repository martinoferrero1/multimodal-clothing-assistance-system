## Purpose

Defines how the assistant remembers and applies user style preferences so recommendations can be personalized while keeping the user's current request authoritative.

## ADDED Requirements

### Requirement: User style preferences are persisted separately from search priorities
The system SHALL store personalized style preferences separately from search priority preferences and SHALL preserve existing search priority behavior when style preferences are absent or disabled.

#### Scenario: Existing search priorities continue to work
- **WHEN** a user has configured search priority fields and has no style preferences
- **THEN** product search SHALL use the configured search priority fields exactly as before

#### Scenario: Style memory does not rewrite search priorities
- **WHEN** a user stores style preferences such as preferred colors, styles, brands, fits, or avoided attributes
- **THEN** the system SHALL NOT convert those style preferences into search priority fields unless the user explicitly configures search priorities

### Requirement: Explicit style preferences are user-managed
The system SHALL allow authenticated users to view, update, and clear explicitly declared style preferences that may include liked styles, disliked styles, preferred colors, avoided colors, preferred brands, avoided brands, preferred fits, sizing notes, budget notes, occasions, and free-form style notes.

#### Scenario: User saves explicit style preferences
- **WHEN** an authenticated user updates their explicit style preferences
- **THEN** subsequent reads of the user profile SHALL include the saved explicit preferences

#### Scenario: User clears explicit style preferences
- **WHEN** an authenticated user clears their explicit style preferences
- **THEN** future personalized recommendations SHALL no longer use those cleared explicit preferences

### Requirement: Inferred style preferences are transparent and removable
The system SHALL distinguish inferred style preferences from explicit preferences and SHALL expose enough information for users to review and remove inferred preferences before they are used in future personalization.

#### Scenario: Inferred preference is shown separately
- **WHEN** the system records a style preference inferred from user interactions
- **THEN** the user profile SHALL identify it as inferred rather than explicit

#### Scenario: User removes inferred preference
- **WHEN** an authenticated user removes an inferred preference
- **THEN** future personalized recommendations SHALL no longer use that inferred preference

### Requirement: Conversation style preferences are temporary
The system SHALL support conversation-scoped temporary style preferences that affect only the conversation where they are configured or inferred as temporary.

#### Scenario: Temporary preference affects current conversation
- **WHEN** a conversation has a temporary style preference such as "more formal" or "avoid sneakers"
- **THEN** recommendations in that conversation SHALL consider the temporary preference when it does not conflict with the current user request

#### Scenario: Temporary preference does not leak to other conversations
- **WHEN** a user starts or opens a different conversation
- **THEN** temporary style preferences from another conversation SHALL NOT affect recommendations in that different conversation

### Requirement: Current user request takes precedence over remembered preferences
The system SHALL treat the latest user request and explicit constraints in the active conversation as higher priority than temporary, explicit, inferred, and default style preferences.

#### Scenario: Current request conflicts with remembered color preference
- **WHEN** a user whose remembered preference favors black asks for a yellow jacket
- **THEN** the system SHALL search and respond for a yellow jacket rather than replacing yellow with black

#### Scenario: Current request conflicts with avoided style
- **WHEN** a user whose remembered preference avoids formal looks asks for a formal wedding outfit
- **THEN** the system SHALL prioritize the formal wedding outfit request over the remembered avoidance

### Requirement: Personalized style usage is configurable
The system SHALL allow users to enable or disable personalized style usage globally and SHALL allow a conversation-level override when a user wants a specific conversation to include or ignore personalized style context.

#### Scenario: Global personalization is disabled
- **WHEN** a user disables personalized style usage globally
- **THEN** new recommendations SHALL NOT use stored explicit or inferred user style preferences unless the active conversation explicitly enables personalization

#### Scenario: Conversation disables personalization
- **WHEN** a conversation disables personalized style usage
- **THEN** recommendations in that conversation SHALL ignore stored user style preferences while preserving the current request and temporary conversation preferences explicitly provided for that conversation

### Requirement: Effective style context is applied as soft recommendation guidance
The system SHALL apply enabled style preferences as soft guidance for recommendation extraction, ranking, outfit composition, and response writing, and SHALL avoid presenting remembered preferences as hard requirements unless they came from the current request.

#### Scenario: Preference guides recommendations without hard filtering
- **WHEN** enabled style preferences indicate the user likes minimalist outfits and the current request does not specify a style
- **THEN** recommendations and response rationale SHALL prefer minimalist-compatible options when available without excluding all other suitable matches

#### Scenario: Response indicates personalization only when used
- **WHEN** personalized style preferences influence the recommendation response
- **THEN** the assistant response SHALL be allowed to reference the relevant style preference at a high level without exposing raw preference metadata

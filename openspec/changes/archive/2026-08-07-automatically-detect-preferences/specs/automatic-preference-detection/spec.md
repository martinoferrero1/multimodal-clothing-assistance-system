## Purpose

Defines how the assistant automatically detects, records, aggregates, and applies learned user preferences from chat behavior while preserving current-request precedence and user control.

## ADDED Requirements

### Requirement: Preference signals are recorded from supported request fields
The system SHALL record preference evidence from user messages and extracted product solicitations for fields already supported by recommendation extraction and search behavior, including usage, price, gender, brands, seasons, colors, and product taxonomy values.

#### Scenario: Request field contributes weak evidence
- **WHEN** a user asks for black sneakers and the extractor produces a garment request with `base_colors` containing black and `article_types` containing sneakers
- **THEN** the system SHALL record weak positive preference signals for those request values
- **AND** the system SHALL NOT immediately treat those signals as durable hard preferences

#### Scenario: Unsupported field is ignored
- **WHEN** a message contains a value that cannot be mapped to a supported preference field
- **THEN** the system SHALL ignore that value for automatic preference learning

### Requirement: Explicit preference language has higher learning strength
The system SHALL distinguish explicit preference statements from ordinary product requests and SHALL assign stronger positive or negative evidence to explicit preference language.

#### Scenario: Explicit positive preference is learned
- **WHEN** a user says they prefer minimalist black outfits
- **THEN** the system SHALL record stronger positive preference signals for minimalist styling and black color than it would for a one-off black outfit request

#### Scenario: Explicit negative preference is learned
- **WHEN** a user says they do not like Nike products
- **THEN** the system SHALL record a negative preference signal for the Nike brand

### Requirement: Learned preferences use frequency and recency
The system SHALL aggregate preference signals using both observation frequency and recency so repeated recent patterns are more influential than stale or isolated observations.

#### Scenario: Repeated recent requests increase confidence
- **WHEN** a user repeatedly requests black products across multiple recent turns
- **THEN** the learned black color preference SHALL increase in occurrence count and confidence

#### Scenario: Stale preference decays
- **WHEN** a preference was observed many times historically but has not appeared recently
- **THEN** its effective learned score SHALL be lower than an otherwise equivalent recently observed preference

### Requirement: Ambiguous signals are not promoted prematurely
The system SHALL avoid promoting ambiguous, low-confidence, or likely one-off signals into durable inferred preferences.

#### Scenario: Single one-off request remains evidence only
- **WHEN** a user asks once for a yellow jacket
- **THEN** the system SHALL keep the yellow color signal below the durable inferred preference threshold unless supported by stronger or repeated evidence

#### Scenario: Third-party shopping context is downgraded
- **WHEN** a user indicates they are shopping for someone else
- **THEN** signals from that request SHALL be ignored or downgraded for durable user preference learning

### Requirement: Learned preferences affect future turns only
The system SHALL apply newly learned signals only to subsequent message turns and SHALL NOT use signals learned from the current message to personalize the same turn.

#### Scenario: Current turn is not self-personalized
- **WHEN** a user asks for red sneakers and no prior red preference exists
- **THEN** the current recommendation SHALL be based on the current red sneaker request
- **AND** any learned red signal from that message SHALL only be available to future turns

### Requirement: Current request overrides learned memory
The system SHALL treat learned preferences as soft guidance and SHALL keep explicit constraints in the latest user request higher priority than learned preference memory.

#### Scenario: Learned color does not override current color
- **WHEN** a user has a learned preference for black products
- **AND** the user asks for a yellow jacket
- **THEN** the system SHALL search and respond for a yellow jacket rather than replacing yellow with black

#### Scenario: Learned brand does not override current brand
- **WHEN** a user has a learned preference for Adidas
- **AND** the user asks for Nike shoes
- **THEN** the system SHALL prioritize Nike shoes over the learned Adidas preference

### Requirement: Manual and conversation preferences preserve existing precedence
The system SHALL preserve the existing style preference precedence when adding automatically learned preferences: latest user message, relevant conversation-temporary preferences, manual user explicit preferences, automatically inferred user preferences, then defaults.

#### Scenario: Manual preference outranks learned preference
- **WHEN** a user has manually saved Adidas as a preferred brand
- **AND** automatic learning has inferred a Nike brand preference
- **AND** the latest user request does not specify a brand
- **THEN** recommendation guidance SHALL prefer the manual Adidas preference over the learned Nike preference

#### Scenario: Latest chat instruction outranks manual preference
- **WHEN** a user has manually saved Adidas as a preferred brand
- **AND** the user asks for Nike shoes in the latest message
- **THEN** the system SHALL prioritize Nike shoes over the manual Adidas preference

#### Scenario: Relevant conversation context outranks durable memory
- **WHEN** a user has a durable manual or learned casual-style preference
- **AND** the active conversation has a temporary instruction to keep this chat formal
- **AND** the latest user request does not conflict with formal styling
- **THEN** recommendation guidance SHALL consider the formal conversation preference before durable user memory

#### Scenario: Conversation context does not override newer explicit chat request
- **WHEN** the active conversation has a temporary instruction to keep this chat formal
- **AND** the user later asks for a sporty casual outfit in the latest message
- **THEN** the latest sporty casual request SHALL take precedence over the temporary formal context

### Requirement: Learned preferences are transparent and removable
The system SHALL expose promoted learned preferences separately from explicit preferences and SHALL provide enough metadata for users to understand and remove them.

#### Scenario: Learned preference is shown with metadata
- **WHEN** a learned preference is promoted from aggregate evidence
- **THEN** authenticated user profile reads SHALL include the preference field, value, confidence, occurrence count, last-seen timestamp, and concise evidence summary

#### Scenario: Removed learned preference does not immediately reappear
- **WHEN** a user removes an inferred learned preference
- **THEN** future recommendations SHALL stop using that preference
- **AND** old evidence SHALL NOT immediately recreate the same inferred preference without new qualifying evidence

### Requirement: Learned preferences respect personalization controls
The system SHALL respect existing personalized-style usage controls when applying learned preferences and SHALL define whether automatic learning itself is disabled or only its usage is disabled.

#### Scenario: Personalized style usage is disabled
- **WHEN** a user disables personalized style usage globally
- **THEN** recommendations SHALL NOT use learned preferences unless the active conversation explicitly enables personalization

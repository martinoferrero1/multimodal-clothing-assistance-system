## Purpose

Defines the expected behavior of the authenticated Lookeate frontend, including
the product Home, module availability, Lookeate Assistant, settings, and
recommendation viewing surfaces.

## Requirements

### Requirement: Home is the authenticated default destination
The system SHALL present the Lookeate Home after authentication instead of
opening a new Assistant conversation automatically.

#### Scenario: User signs in or registers
- **WHEN** authentication succeeds
- **THEN** the user SHALL arrive at the Lookeate Home
- **AND** a conversation SHALL NOT be opened automatically

#### Scenario: Authenticated user opens the root route
- **WHEN** an authenticated user visits `/`
- **THEN** the system SHALL render the Lookeate Home

### Requirement: Home communicates the product areas and their availability
The system SHALL present Lookeate Assistant, Create a garment, Create your
style, and Explore catalogs as distinct product experiences on Home.

#### Scenario: User opens the available experience
- **WHEN** the user activates the Lookeate Assistant card or action
- **THEN** the system SHALL navigate to a new Assistant conversation

#### Scenario: User views an upcoming experience
- **WHEN** Home renders Create a garment, Create your style, or Explore catalogs
- **THEN** the experience SHALL be visibly marked as coming soon
- **AND** it SHALL NOT expose an interactive navigation control

### Requirement: Beta status applies to the complete product
The system SHALL communicate that Lookeate as a whole is in Beta from Home and
SHALL NOT attach the Beta label specifically to Lookeate Assistant.

#### Scenario: User compares Home and Assistant branding
- **WHEN** the user views Home and then opens Lookeate Assistant
- **THEN** Home SHALL contain the product-level Beta status
- **AND** the Assistant header and sidebar SHALL identify the module as
  "Lookeate Assistant" without a local Beta label

### Requirement: Workspace chrome stays visually integrated
The system SHALL render Home, Lookeate Assistant, the Assistant sidebar, the
settings modal, and recommendation surfaces with a cohesive dark monochromatic
theme, subtle borders, softened color contrast, and restrained accent color.

#### Scenario: Home and Assistant share the same visual system
- **WHEN** the authenticated product is displayed
- **THEN** Home, the Assistant sidebar and conversation, Settings, and
  recommendation panels SHALL use compatible typography, surface colors,
  borders, and interaction states

#### Scenario: Chat remains visually loose
- **WHEN** messages are displayed in the chat workspace
- **THEN** the chat area SHALL avoid an enclosing card-like shell and SHALL keep
  the message column centered with comfortable width on desktop

### Requirement: Sidebar supports desktop collapse and mobile drawer behavior
The system SHALL let users hide and reveal the Lookeate Assistant sidebar
without leaving the active conversation.

#### Scenario: Desktop sidebar can be hidden and restored
- **WHEN** a desktop user hides the sidebar
- **THEN** the sidebar SHALL collapse out of view and a restore control SHALL be
  available in the workspace

#### Scenario: Mobile sidebar behaves as a drawer
- **WHEN** a small-screen user opens the sidebar
- **THEN** the sidebar SHALL appear as an overlay drawer and SHALL close without
  changing the active conversation

#### Scenario: Assistant sidebar exposes product navigation
- **WHEN** the Lookeate Assistant sidebar is visible
- **THEN** it SHALL provide access to Home and Lookeate Assistant
- **AND** it SHALL NOT contain the future Create your style experience

### Requirement: Sidebar settings area is separated from conversations
The system SHALL visually separate conversation history from the sidebar
settings/account area using a single subtle divider.

#### Scenario: Conversation list scrolls above settings
- **WHEN** the conversation list overflows
- **THEN** the settings/account area SHALL remain visually boxed by the sidebar
  edges and divider without its boundary cutting through a conversation row

### Requirement: Settings are shown in a modal
The system SHALL present global product settings in a shared modal from Home
and Lookeate Assistant.

#### Scenario: User opens global settings
- **WHEN** the user activates Settings from the Home account menu or the
  Assistant sidebar
- **THEN** a modal SHALL open with section navigation and a flat close control
  matching the rest of the workspace controls

#### Scenario: General and Assistant preferences remain separated
- **WHEN** the Settings modal is open
- **THEN** General SHALL contain only the application language control
- **AND** Lookeate Assistant SHALL contain sidebar, recommendation panel,
  search-priority, and style-memory preferences
- **AND** Account SHALL remain a separate section

#### Scenario: Interface preferences update live surfaces
- **WHEN** the user changes an interface preference
- **THEN** the workspace SHALL synchronize affected UI regions without requiring
  a page reload

### Requirement: Recommendation panel preference controls outfit viewing surface
The system SHALL let users choose whether outfit recommendations open in a side
panel or in a dedicated modal.

#### Scenario: Panel mode is enabled on large screens
- **WHEN** recommendation panel mode is enabled and the viewport supports the
  side panel
- **THEN** selecting an outfit SHALL open or reveal the recommendation panel and
  mark that outfit as being viewed

#### Scenario: Panel mode is disabled
- **WHEN** recommendation panel mode is disabled
- **THEN** selecting an outfit SHALL open the outfit modal instead of the side
  panel

#### Scenario: Disabling panel mode clears stale selection
- **WHEN** an outfit is marked as viewed in panel mode
- **AND** the user disables recommendation panel mode from Settings
- **THEN** the outfit SHALL no longer remain marked as viewed

### Requirement: Recommendation surfaces avoid duplicate headings
The system SHALL avoid repeating generic recommendation section headings when
rendering product or outfit recommendations.

#### Scenario: Product groups render directly
- **WHEN** assistant payload sections contain product highlights or garment
  recommendations
- **THEN** the UI SHALL render the product groups directly and use each product
  group label as the local heading

#### Scenario: Outfit surface is titled by selected outfit
- **WHEN** an outfit is opened in the side panel or modal
- **THEN** the surface title SHALL use the selected outfit name and SHALL NOT
  repeat that same title inside the content body

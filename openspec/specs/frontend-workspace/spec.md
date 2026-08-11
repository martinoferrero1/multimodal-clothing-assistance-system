## Purpose

Defines the expected behavior of the authenticated frontend workspace, including
navigation chrome, chat rendering, settings, and recommendation viewing
surfaces.

## Requirements

### Requirement: Workspace chrome stays visually integrated
The system SHALL render the chat workspace, sidebar, settings modal, and
recommendation surfaces with a cohesive dark translucent theme, subtle borders,
and softened color contrast.

#### Scenario: Chat and panels share the same visual system
- **WHEN** the authenticated workspace is displayed
- **THEN** the sidebar, chat, settings modal, and recommendation panel SHALL use
  compatible surface colors, blur treatment, borders, and hover states

#### Scenario: Chat remains visually loose
- **WHEN** messages are displayed in the chat workspace
- **THEN** the chat area SHALL avoid an enclosing card-like shell and SHALL keep
  the message column centered with comfortable width on desktop

### Requirement: Sidebar supports desktop collapse and mobile drawer behavior
The system SHALL let users hide and reveal the left sidebar without leaving the
chat workspace.

#### Scenario: Desktop sidebar can be hidden and restored
- **WHEN** a desktop user hides the sidebar
- **THEN** the sidebar SHALL collapse out of view and a restore control SHALL be
  available in the workspace

#### Scenario: Mobile sidebar behaves as a drawer
- **WHEN** a small-screen user opens the sidebar
- **THEN** the sidebar SHALL appear as an overlay drawer and SHALL close without
  changing the active conversation

### Requirement: Sidebar settings area is separated from conversations
The system SHALL visually separate conversation history from the sidebar
settings/account area using a single subtle divider.

#### Scenario: Conversation list scrolls above settings
- **WHEN** the conversation list overflows
- **THEN** the settings/account area SHALL remain visually boxed by the sidebar
  edges and divider without its boundary cutting through a conversation row

### Requirement: Settings are shown in a modal
The system SHALL present global workspace settings in a modal from the
authenticated shell.

#### Scenario: User opens global settings
- **WHEN** the user activates Settings from the sidebar
- **THEN** a modal SHALL open with section navigation and a flat close control
  matching the rest of the workspace controls

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

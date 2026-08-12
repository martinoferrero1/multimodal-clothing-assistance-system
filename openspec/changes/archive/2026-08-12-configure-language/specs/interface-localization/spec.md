## Purpose

Defines how Lookeate selects, persists, and applies a supported language to translatable frontend interface content while preserving names and conversation data.

## ADDED Requirements

### Requirement: Lookeate supports English and Spanish interface languages
The system SHALL provide complete English and Spanish translations for frontend-owned, user-facing interface copy, including navigation, authentication, settings, chat controls, recommendation controls, statuses, validation messages, and errors.

#### Scenario: User views the interface in English
- **WHEN** English is the active language
- **THEN** translatable frontend interface copy SHALL be displayed in English

#### Scenario: User views the interface in Spanish
- **WHEN** Spanish is the active language
- **THEN** translatable frontend interface copy SHALL be displayed in Spanish

### Requirement: English is the safe default language
The system SHALL use English when no language preference exists or when a stored language value is missing, invalid, or unsupported.

#### Scenario: First visit has no saved preference
- **WHEN** a user opens Lookeate without a saved language preference
- **THEN** the interface SHALL be displayed in English

#### Scenario: Saved preference is not supported
- **WHEN** the saved language preference is not English or Spanish
- **THEN** the interface SHALL fall back to English without preventing the application from loading

### Requirement: Language can be selected from General settings
The system SHALL present a language control in the General section of Settings with English and Spanish as the available options.

#### Scenario: User selects Spanish
- **WHEN** the user selects Spanish in General settings
- **THEN** Spanish SHALL become the active language and the open Settings interface SHALL update without a page reload

#### Scenario: User selects English
- **WHEN** the user selects English in General settings
- **THEN** English SHALL become the active language and the open Settings interface SHALL update without a page reload

### Requirement: Language changes apply globally and persist locally
The system SHALL apply the selected language to all mounted frontend interface surfaces, store it with browser interface preferences, and restore it on subsequent visits in the same browser.

#### Scenario: Other open interface surfaces react to a change
- **WHEN** the user changes the language while workspace, chat, or recommendation surfaces are mounted
- **THEN** those surfaces SHALL update their translatable copy without a page reload or loss of current application state

#### Scenario: User returns after selecting Spanish
- **WHEN** the user previously selected Spanish and later opens Lookeate in the same browser
- **THEN** the interface SHALL restore Spanish as the active language

### Requirement: Locale-sensitive presentation follows the active language
The system SHALL format frontend-presented dates, times, relative date labels, and equivalent locale-sensitive values according to the active language and SHALL expose the active language as the document language.

#### Scenario: Spanish locale is active
- **WHEN** Spanish is the active language
- **THEN** locale-sensitive values and the document language SHALL use Spanish conventions

#### Scenario: English locale is active
- **WHEN** English is the active language
- **THEN** locale-sensitive values and the document language SHALL use English conventions

### Requirement: Content that is not interface copy remains unchanged
The system SHALL NOT translate the Lookeate product name, user-provided conversation content, previously generated assistant messages, email addresses, product or brand names, proper names, or externally supplied catalog and API content solely because the interface language changes.

#### Scenario: Conversation remains intact after language change
- **WHEN** the user changes the active language while viewing an existing conversation
- **THEN** user messages and previously generated assistant message content SHALL remain unchanged while surrounding interface controls are translated

#### Scenario: Product identity remains intact after language change
- **WHEN** a recommendation is displayed in either supported language
- **THEN** product names, brand names, and other externally supplied product identity values SHALL be displayed as received

#### Scenario: Lookeate branding remains intact
- **WHEN** either supported language is active
- **THEN** the public application name SHALL remain "Lookeate"

## Why

Lookeate currently presents its interface only in English, which makes the workspace less accessible to Spanish-speaking users. A global language preference is needed so users can switch the translatable interface without changing product identity or content that conventionally remains untranslated.

## What Changes

- Add a language selector to the General section of Settings with English and Spanish options.
- Use English as the default language when no valid preference has been saved.
- Persist the selected language with the existing browser interface preferences and apply changes immediately across the frontend.
- Localize user-facing interface copy, including navigation, settings, authentication, chat controls, status messages, errors, recommendation surfaces, and locale-sensitive dates.
- Keep the Lookeate name, user-provided content, product and brand names, email addresses, and other proper or externally sourced names unchanged.

## Capabilities

### New Capabilities

- `interface-localization`: Defines supported interface languages, language selection and persistence, live locale changes, and the boundary between translated UI copy and untranslated names or user/external content.

### Modified Capabilities

None.

## Impact

- Affects the frontend settings preference model, browser persistence, workspace shell, and all user-facing frontend copy.
- Introduces a shared localization mechanism and English and Spanish message catalogs; the exact implementation may use a lightweight internal solution rather than a new runtime dependency.
- Requires locale-aware formatting for dates and other presentation values while preserving stored and API data unchanged.
- Does not require backend API or database schema changes in this phase.

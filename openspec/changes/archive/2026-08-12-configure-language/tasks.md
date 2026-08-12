## 1. Locale Foundation

- [x] 1.1 Add the typed `en` and `es` language model and English/Spanish message catalogs, with interpolation support and compile-time catalog shape parity.
- [x] 1.2 Extend `SettingsPreferences` and browser preference storage with a validated language value that defaults invalid, unsupported, or absent values to English while preserving existing preferences.
- [x] 1.3 Add a root locale provider and translation hook that restore the saved preference, subscribe to `preferences:changed`, and keep `document.documentElement.lang` synchronized without hydration errors.

## 2. General Settings

- [x] 2.1 Add an accessible English/Spanish language selector to the General Settings section using the established preference persistence and change notification flow.
- [x] 2.2 Convert all Settings section navigation, preference labels, style controls, account labels, statuses, errors, placeholders, and accessible text to localized message keys so the open modal reacts immediately to selection changes.

## 3. Frontend Localization Coverage

- [x] 3.1 Localize authentication routes and components, including headings, field labels, placeholders, actions, validation, loading states, and frontend fallback errors while keeping Lookeate unchanged.
- [x] 3.2 Localize workspace shell, guard, sidebar, and conversation navigation copy, including accessible labels, empty states, relative-date groups, and fallback conversation titles.
- [x] 3.3 Localize chat workspace controls, dialogs, upload states, empty states, progress/status copy, and frontend fallback errors without modifying user messages or previously generated assistant content.
- [x] 3.4 Localize recommendation and assistant-message presentation controls, labels, empty/fallback interface copy, and accessibility text while preserving product names, brands, catalog attributes, and externally supplied content.
- [x] 3.5 Audit remaining user-facing literals under frontend `app/`, `components/`, and relevant `lib/` modules; move frontend-owned copy into both catalogs and document through code structure any intentionally untranslated dynamic/external values.

## 4. Locale-Sensitive Formatting

- [x] 4.1 Refactor date, time, relative-day, conversation fallback, product fallback, and related presentation helpers to accept explicit locale or translated labels instead of fixed English values.
- [x] 4.2 Update every formatter call site to use the active language and verify English and Spanish conventions while leaving stored/API values unchanged.

## 5. Verification

- [x] 5.1 Run `npm run lint` and `npm run build` from `src/frontend` and resolve all localization typing, lint, rendering, and build failures.
- [x] 5.2 Manually verify first-visit English, invalid-value fallback, English/Spanish switching without reload, persistence across reloads, document language, and preservation of an active conversation and external content.
- [x] 5.3 Manually exercise auth, Settings, sidebar, chat, dialogs, and recommendation surfaces in both languages at desktop and mobile widths, checking Spanish wrapping and localization completeness.

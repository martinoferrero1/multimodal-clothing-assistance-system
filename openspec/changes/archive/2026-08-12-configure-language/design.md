## Context

See `proposal.md` for motivation and `specs/interface-localization/spec.md` for the behavior contract. The Next.js frontend currently embeds English copy directly across auth, workspace, settings, chat, recommendation, formatting, and error states. Interface preferences are represented by `SettingsPreferences`, stored in browser `localStorage`, and announced through `preferences:changed`; dates and relative labels are currently fixed to `en-US`.

The language must be available on unauthenticated and authenticated routes, update already mounted components, and remain safe during server rendering where browser storage is unavailable. There is no frontend test framework or localization dependency today.

## Goals / Non-Goals

**Goals:**

- Establish one typed source of truth for the active language and frontend-owned messages.
- Reuse the existing browser preference storage and change event rather than create a second persistence path.
- Make locale-sensitive formatters consume the same active language as translated copy.
- Keep adding another catalog in the future straightforward, without designing dynamic locale loading now.
- Avoid introducing a runtime dependency for two static locales.

**Non-Goals:**

- Persist language per account or synchronize it between browsers and devices.
- Translate API payload data, catalog values, user text, or existing conversation messages.
- Force the backend assistant to answer in the configured interface language.
- Localize URLs, server APIs, or the invariant Lookeate product name.
- Add automatic browser-language detection; an absent or invalid preference resolves to English.

## Decisions

1. Use a small internal localization layer with typed message catalogs.

Create a client-accessible locale module that defines the supported `en` and `es` language codes, English and Spanish dictionaries, interpolation for the limited dynamic labels, and a translation hook supplied by a root locale provider. Derive the message-key type from the canonical English catalog so TypeScript catches missing or invalid keys, and require the Spanish catalog to satisfy the same shape.

This is preferable to adding a framework such as `next-intl` because locale routing, server-selected locales, ICU message loading, and large catalog tooling are outside the current two-language, local-preference scope. Direct component-level conditional strings were rejected because they duplicate selection logic and make coverage difficult to audit.

2. Store the language in `SettingsPreferences` and validate it at the storage boundary.

Add a `language` field whose supported values are `en` and `es`, with `en` in `defaultPreferences`. `readPreferences` will normalize an unknown persisted value back to English while preserving valid existing preference fields. Settings will continue writing the complete preference object and dispatching `preferences:changed`.

This reuses an established update mechanism and automatically migrates existing browser data through default merging. A backend user preference was rejected for now because it would require API and database changes for a preference explicitly scoped to the browser interface.

3. Mount one locale provider at the application root.

The provider will subscribe to the persisted preference and `preferences:changed`, expose the active language and translation function to every route, and update `document.documentElement.lang`. The server-safe snapshot is English; after hydration, a persisted Spanish preference becomes authoritative. Components will not keep independent language state, including Settings, which updates the shared preference and consumes the provider like other surfaces.

Mounting at the root covers both authentication and workspace routes. Reusing an external-store-style subscription or equivalent single subscription avoids manually threading locale props and ensures mounted surfaces rerender without losing state. Reading `localStorage` independently in every component was rejected because it creates inconsistent snapshots and repeated event wiring.

4. Replace frontend-owned copy with message keys, but preserve content provenance boundaries.

Translate literal UI labels, placeholders, accessible labels, empty states, loading/saving statuses, frontend validation, and frontend fallback errors in `app/`, `components/`, and relevant `lib/` helpers. Configuration arrays that currently contain labels or descriptions will store message keys or be built inside localized consumers. The Lookeate token remains identical in both catalogs.

Values received as user content, assistant message content, API error detail, catalog attributes, product/brand names, account names, and email addresses remain untouched. Where the frontend wraps such data with its own labels, only the wrapper is translated. This boundary avoids misleading transformations and preserves stored data exactly.

5. Make formatting functions locale-aware through explicit inputs.

Formatting helpers will accept the active language or locale-dependent labels rather than reading React context from utility code. `en` maps to an English locale and `es` to a Spanish locale for `Intl.DateTimeFormat`; relative day buckets and frontend-owned fallback text will come from the message catalog. Call sites obtain the language and translator from the provider.

Explicit parameters keep pure helpers usable outside React and make locale behavior visible at call sites. A mutable module-global locale was rejected because it is harder to reason about and test.

6. Verify completeness through type checking and a source-copy audit.

The catalog shape provides compile-time parity between locales. Implementation will also search user-facing frontend files for remaining hard-coded English literals and classify each as translated interface copy or intentionally preserved dynamic/external content. Existing `npm run lint` and `npm run build` provide the available automated checks, followed by manual English/Spanish flows on desktop and mobile.

Adding a new test runner solely for this change was rejected as disproportionate; pure localization tests can be introduced later when the frontend has an established test setup.

## Risks / Trade-offs

- [A persisted Spanish locale is only known in the browser, so server-rendered output starts from English] -> Keep the server snapshot deterministic, update immediately after hydration, and avoid rendering different initial client markup that would cause hydration errors.
- [Hard-coded copy may be missed across the frontend] -> Use typed catalogs, audit all frontend user-facing literals, and manually exercise auth, settings, sidebar, chat, and recommendation flows in both languages.
- [Spanish text can be longer and expose layout issues] -> Validate responsive settings, sidebar, dialogs, buttons, and recommendation surfaces at desktop and mobile widths; allow wrapping rather than truncating meaningful controls.
- [Backend error detail or assistant output may remain English] -> Preserve externally supplied content by design and ensure surrounding frontend fallback and status copy is localized.
- [An internal localization layer has fewer pluralization features than a mature library] -> Keep the API key-based and interpolation-capable; reassess a standard library if locale count or grammatical complexity grows.

## Migration Plan

1. Extend default browser preferences with `language: "en"` and validate persisted values when reading them; existing stored preferences require no destructive migration.
2. Add the root provider and catalogs, initially preserving English behavior.
3. Convert formatting and user-facing frontend surfaces to consume the locale layer, then add the Settings selector.
4. Run lint and production build, audit untranslated literals, and manually verify both locales and persistence.
5. Roll back by removing the provider, catalogs, selector, and preference field; the extra key in existing browser JSON is harmless to the previous preference reader.

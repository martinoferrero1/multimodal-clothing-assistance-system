## 1. Data Model And Schemas

- [x] 1.1 Add nullable JSON storage for user style preferences and conversation style preferences to chat database models.
- [x] 1.2 Extend startup schema migration logic to add the new JSON columns for existing SQLite and PostgreSQL databases.
- [x] 1.3 Add backend read/update schemas for explicit style preferences, inferred style preference entries, temporary conversation preferences, personalization toggles, and effective style context.
- [x] 1.4 Add frontend TypeScript types matching the backend style preference read/update payloads.

## 2. Style Preference Service

- [x] 2.1 Create a style preference service that normalizes explicit, inferred, and temporary preference payloads.
- [x] 2.2 Implement defaulting behavior for missing user and conversation style preference storage.
- [x] 2.3 Implement user-level updates for explicit preferences and global personalized-style usage.
- [x] 2.4 Implement inferred preference removal by stable inferred preference ID.
- [x] 2.5 Implement conversation-level updates for temporary preferences and conversation personalization override.
- [x] 2.6 Implement effective style context resolution with precedence: latest request, conversation temporary, user explicit, user inferred, defaults.

## 3. Backend API Integration

- [x] 3.1 Include user style preference data in authenticated user read responses.
- [x] 3.2 Add authenticated user endpoints for updating explicit style preferences, clearing explicit style preferences, toggling personalized style usage, and removing inferred entries.
- [x] 3.3 Include conversation style preference data and effective personalization state in conversation read responses.
- [x] 3.4 Add conversation endpoints for updating temporary style preferences and personalization override.
- [x] 3.5 Ensure existing search preference endpoints and response shapes remain compatible.

## 4. Runtime And Graph Integration

- [x] 4.1 Add a style preference context state key and typed state entry.
- [x] 4.2 Resolve effective style context in conversation service before invoking the runtime.
- [x] 4.3 Pass style preference context through initial graph state and resume commands.
- [x] 4.4 Add compact style preference context to outfit request extraction prompts with current-request precedence instructions.
- [x] 4.5 Add compact style preference context to final response writing so personalization rationale is available only when used.

## 5. Product Search And Recommendation Behavior

- [x] 5.1 Extend product search inputs to accept effective style preference context without changing search priority field behavior.
- [x] 5.2 Use non-conflicting style guidance as soft semantic query/ranking input rather than hard filtering.
- [x] 5.3 Add conservative ranking handling for preferred and avoided catalog-backed values such as colors and brands.
- [x] 5.4 Verify current request constraints override remembered style preferences in extraction and search behavior.

## 6. Frontend Experience

- [x] 6.1 Add settings UI for global personalized-style usage.
- [x] 6.2 Add settings UI for viewing, editing, and clearing explicit style preferences.
- [x] 6.3 Add settings UI for viewing and removing inferred style preferences separately from explicit preferences.
- [x] 6.4 Add chat-level controls for temporary style preferences and conversation personalization override.
- [x] 6.5 Refresh auth and conversation providers after preference updates so UI state stays synchronized.
- [x] 6.6 Present global settings in a workspace modal and conversation settings in the chat composer modal.
- [x] 6.7 Keep interface-only preferences synchronized through `preferences:changed`, including recommendation panel mode.
- [x] 6.8 Clear stale outfit selection when recommendation panel mode is disabled.

## 7. Frontend Workspace Polish

- [x] 7.1 Align chat, sidebar, settings, recommendation panel, and modal colors into a cohesive translucent theme.
- [x] 7.2 Convert the left navigation from a floating bubble into a collapsible sidebar panel with subtle dividers.
- [x] 7.3 Use a centered, wider GPT-style message column without an enclosing chat card.
- [x] 7.4 Render product recommendations without duplicate generic section headings.
- [x] 7.5 Render outfit detail surfaces using the selected outfit name once, with matching flat close controls.
- [x] 7.6 Support manually hiding and revealing the recommendation panel with a smooth transition.

## 8. Tests And Validation

- [x] 8.1 Add backend tests for style preference normalization and defaulting.
- [x] 8.2 Add backend tests for effective context precedence and personalization toggle behavior.
- [x] 8.3 Add backend tests proving existing search priority behavior is unchanged when style preferences are absent or disabled.
- [x] 8.4 Add backend tests for current-request-over-memory conflicts such as yellow request versus black remembered preference.
- [ ] 8.5 Run `PYTHONPATH=src python -m pytest tests/` after installing backend test dependencies in the active Python environment.
- [x] 8.6 Run `npm run lint` from `src/frontend` after frontend changes.
- [x] 8.7 Run `npm run build` from `src/frontend` after frontend changes.

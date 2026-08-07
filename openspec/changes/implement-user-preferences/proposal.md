## Why

The assistant currently supports `search_preferences`, but those preferences only control which search fields are prioritized. Users need richer style memory so future recommendations can reflect durable tastes, conversation-specific temporary preferences, and inferred patterns without overriding the user's current request.

## What Changes

- Add a user style preference capability that stores explicit preferences, inferred preferences, and a personalization toggle for whether assistant responses should use personalized style context.
- Add conversation-scoped temporary style preferences and an optional conversation override for personalized-style usage.
- Inject effective style preference context into the recommendation workflow so extraction, product search, outfit building, and final response writing can use it as soft guidance.
- Enforce precedence so the latest user request always wins over temporary, explicit, inferred, and default preference context.
- Expose API and frontend settings for viewing/updating explicit preferences, reviewing/removing inferred preferences, and toggling personalized style usage.
- Keep existing `search_preferences` behavior intact and separate from richer style memory.

## Capabilities

### New Capabilities
- `user-style-preferences`: Covers storing, managing, applying, and disabling personalized style preferences across users and conversations.

### Modified Capabilities
- None.

## Impact

- Backend persistence: user and conversation records need new JSON-backed style preference storage and schema migration support.
- Backend APIs: authenticated user and conversation endpoints need read/update support for style preferences and personalization toggles.
- Runtime state: conversation processing needs effective style preference context in graph state.
- Agent prompts/services: outfit extraction, search/ranking, and final response writing need preference-aware guidance that treats remembered style as soft context.
- Frontend: settings and chat preference controls need UI for explicit/inferred/temporary preferences and personalization enablement.
- Tests: service-level tests should cover normalization, precedence, toggle behavior, and request-over-memory conflict handling.

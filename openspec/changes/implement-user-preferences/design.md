## Context

See `proposal.md` for motivation. The current backend stores `search_preferences` as JSON on both `chat_users` and `conversations`; those preferences are normalized by `SearchPreferencesService`, resolved in `ConversationService`, and passed into `ConversationRuntimeService` as `SEARCH_PRIORITY_FIELDS` state.

The graph already has clear handoff points for additional context: `ConversationRuntimeService` builds initial/resume state, `StateKeys` centralizes state keys, `extract_outfit_request` receives a JSON context system message, `search_products` receives structured request/search context, and `FinalResponseService` receives the full state before writing the user-facing response.

The product catalog does not contain a dedicated `style` column. Style memory therefore cannot be a hard database filter. It must be represented as soft guidance for extraction, semantic query/ranking, outfit composition, and response writing.

## Goals / Non-Goals

**Goals:**

- Add style preference storage that is separate from existing search priority storage.
- Represent explicit, inferred, and temporary style preferences distinctly.
- Resolve an effective style context per message turn with predictable precedence.
- Let users disable personalized style usage globally and override that choice per conversation.
- Keep remembered style preferences soft so the current request remains authoritative.
- Provide enough API/frontend surface for users to inspect, update, and remove preference data.

**Non-Goals:**

- Do not replace `search_preferences` or change configured priority field behavior.
- Do not add a new catalog `style` taxonomy or re-seed product data.
- Do not make inferred preferences fully autonomous if there is no review/removal path.
- Do not use style memory as hard filters unless a preference is repeated in the current request.
- Do not introduce external profile, recommendation, or vector-memory infrastructure.

## Decisions

### Decision: Store style memory in separate JSON fields

Add separate JSON storage for user style preferences and conversation style preferences rather than expanding the existing `search_preferences` JSON.

User-level shape should contain:

```json
{
  "use_personalized_styles": true,
  "explicit": {
    "liked_styles": [],
    "disliked_styles": [],
    "preferred_colors": [],
    "avoided_colors": [],
    "preferred_brands": [],
    "avoided_brands": [],
    "preferred_fits": [],
    "occasions": [],
    "budget_notes": null,
    "sizing_notes": null,
    "freeform_notes": null
  },
  "inferred": [
    {
      "id": "...",
      "kind": "preferred_color",
      "value": "black",
      "confidence": 0.72,
      "evidence": "Repeated requests for black sneakers and dark outfits.",
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

Conversation-level shape should contain:

```json
{
  "use_personalized_styles": null,
  "temporary": {
    "liked_styles": [],
    "disliked_styles": [],
    "preferred_colors": [],
    "avoided_colors": [],
    "preferred_brands": [],
    "avoided_brands": [],
    "preferred_fits": [],
    "occasions": [],
    "budget_notes": null,
    "sizing_notes": null,
    "freeform_notes": null
  }
}
```

Rationale: the existing JSON migration style is simple and already supports SQLite/PostgreSQL. Keeping style memory separate avoids overloading `search_preferences` and reduces risk of breaking priority-field behavior.

Alternatives considered:

- Extend `search_preferences`: rejected because it mixes hard search-priority configuration with soft style memory.
- Add normalized relational tables: deferred because current preference payloads are small, nested, and user-scoped; JSON is consistent with current architecture.
- External memory store: rejected as unnecessary for this project size and deployment model.

### Decision: Resolve style context through a dedicated service

Create a style preference service responsible for normalization, validation, defaulting, and effective-context resolution. The service should expose operations conceptually equivalent to:

- Build safe storage from API payloads.
- Read normalized user preferences.
- Read normalized conversation temporary preferences.
- Remove inferred preference entries by ID.
- Resolve effective context for a turn.

Effective context should include both the raw structured preference groups and an LLM-safe summary string. Example:

```json
{
  "enabled": true,
  "sources": {
    "temporary": {...},
    "explicit": {...},
    "inferred": [...]
  },
  "guidance": [
    "User often prefers minimalist styling.",
    "User prefers black and cream when the current request does not specify color.",
    "Avoid neon colors unless the user asks for them."
  ],
  "precedence": [
    "latest_user_request",
    "conversation_temporary",
    "user_explicit",
    "user_inferred",
    "defaults"
  ]
}
```

Rationale: centralizing merge/precedence logic prevents each graph node or API route from interpreting preferences differently.

Alternatives considered:

- Resolve preferences directly in `ConversationService`: rejected because the logic will be reused by API reads and tests.
- Put merge rules in prompts only: rejected because prompt-only precedence is less testable.

### Decision: Precedence is explicit and one-way

The current user request always wins. Conversation temporary preferences only fill gaps or guide style where the current request is silent. User explicit preferences fill remaining gaps. Inferred preferences have the lowest user-memory weight.

```text
latest user request
        |
        v
conversation temporary preferences
        |
        v
user explicit preferences
        |
        v
user inferred preferences
        |
        v
system defaults
```

The implementation should not attempt to mutate the user's extracted request by blindly inserting memory values. Instead, it should provide preference context to the extractor/search/writer with instructions to use it only when non-conflicting.

Rationale: direct mutation makes conflicts hard to detect and can silently override the user. Soft guidance preserves personalization without reducing trust.

Alternatives considered:

- Merge memory values into `GarmentSpec` before search: rejected because it would make remembered style indistinguishable from the current request.
- Use memory only in final response text: rejected because recommendations would not actually become more personalized.

### Decision: Add `STYLE_PREFERENCE_CONTEXT` to graph state

Add a new state key for effective style context and populate it in both initial and resume runtime inputs. The state should be available to:

- Orchestrator: optional awareness that a style preference update may be a settings-like chat instruction or a recommendation refinement.
- Outfit request extractor: soft context when current request lacks style details.
- Product search: optional semantic query/ranking enrichment, not priority filtering.
- Outfit recommendation builder: optional ordering/rationale hints if needed.
- Final response writer: concise rationale when personalized preferences influence the result.

Rationale: graph state is the existing mechanism for passing per-turn context through nodes.

Alternatives considered:

- Append style memory to the human message content: rejected because it contaminates user-authored text and makes precedence harder.
- Store style memory only in conversation summary: rejected because summaries are lossy and not user-manageable.

### Decision: Apply personalization through soft search signals

Because catalog products lack a style field, style preferences should influence search through semantic text and scoring rather than hard filters. Product search can incorporate non-conflicting style guidance into the search text or add small soft bonuses when catalog-backed fields match preference values, such as preferred colors or brands.

Avoided values should be treated conservatively. If the current request asks for an avoided value, the current request wins. If the current request is silent, avoided values can reduce ranking confidence but should not eliminate every product.

Rationale: this matches the available catalog schema and avoids zero-result personalization.

Alternatives considered:

- Add hard filters for remembered colors/brands: rejected because user preferences are not current constraints.
- Ignore style memory in search: rejected because the capability would mostly affect prose, not recommendations.

### Decision: Keep inferred preferences initially simple and reviewable

The first implementation should support storing/removing inferred preferences and can generate them from clear positive/negative interaction signals or explicit conversational statements. Inference should include confidence and evidence. Low-confidence or ambiguous data should not be stored.

Rationale: transparent inferred memory satisfies the spec without requiring a complex autonomous learning system.

Alternatives considered:

- Infer preferences after every turn automatically: deferred due to risk of noisy or surprising memory.
- Require user confirmation before storing every inference: safer but may add UI friction; can be added later if inference quality is poor.

### Decision: API surface mirrors user and conversation scopes

Expose user-level style preferences with authenticated `/me` operations and conversation-level temporary preferences with conversation operations. `UserRead` and `ConversationRead` should include style preference read models so frontend settings and chat controls can render effective state without extra fetches.

The update payloads should support partial updates for explicit preferences, personalization toggles, temporary preferences, and inferred preference removal. Clearing should be explicit rather than relying on missing fields.

Rationale: this follows existing search preference endpoint patterns while giving the UI enough state to be transparent.

Alternatives considered:

- Single generic preferences endpoint: rejected because user and conversation scopes have different authorization and lifecycle behavior.
- Store the personalization toggle only in frontend localStorage: rejected because it changes assistant behavior and must be enforced server-side.

### Decision: Frontend preference controls live in modal surfaces

Global user preferences are surfaced through the workspace Settings modal rather
than as a separate page. Conversation-specific preferences are surfaced from the
chat composer settings control. This keeps the chat as the primary workspace
while still separating global account/style settings from per-conversation
temporary search and style instructions.

Interface-only preferences, such as compact sidebar and recommendation panel
mode, remain in browser `localStorage` because they do not affect backend
recommendation logic. Updating them dispatches `preferences:changed` so active
workspace components can resync immediately.

Recommendation panel mode controls only the display surface for outfit details:
when enabled on large screens, outfit cards open in the side panel; when disabled
or unavailable, they open in a modal. Turning panel mode off clears any active
outfit selection so the chat does not keep a stale "viewing" marker.

## Risks / Trade-offs

- Over-personalization -> Mitigate by treating memory as soft guidance and documenting precedence in prompts and service tests.
- Noisy inferred preferences -> Mitigate with confidence/evidence metadata, conservative inference, and removal controls.
- Prompt bloat -> Mitigate by passing compact guidance strings rather than raw full preference JSON where possible.
- Search quality regressions -> Mitigate with small ranking weights, no hard filtering, and tests for current-request conflicts.
- Privacy/trust concerns -> Mitigate by exposing inferred preferences separately and allowing deletion.
- JSON schema drift -> Mitigate with normalization functions and read models that tolerate missing keys.

## Migration Plan

1. Add nullable JSON columns for user and conversation style preferences using the existing startup migration pattern.
2. Default missing user style preferences to personalization enabled with empty explicit/inferred memory, unless product requirements decide the default should be disabled.
3. Default missing conversation style preferences to no override and empty temporary preferences.
4. Deploy backend read paths before frontend controls so older records remain readable.
5. Rollback is safe if new columns remain unused; existing `search_preferences`, conversations, messages, and product data are not modified by this change.

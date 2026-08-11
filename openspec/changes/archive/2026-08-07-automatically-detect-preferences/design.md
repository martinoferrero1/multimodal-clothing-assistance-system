## Context

The current implementation persists style preferences as JSON on `chat_users` and `conversations`, normalizes them through `StylePreferencesService`, and passes an effective `style_preference_context` into the LangGraph runtime. Product search already uses style context as soft semantic/ranking guidance, not as hard filters.

The existing `inferred` preference model is transparent and removable, but no runtime path creates inferred preferences automatically. The previous user preferences design explicitly deferred automatic after-turn inference because of noisy-memory risk. This change reopens that decision with stricter constraints: store evidence, score by frequency and recency, and only promote conservative signals into usable memory.

The fields already available from `GarmentSpec` and `OutfitSpec` provide the initial learning surface: `usage`, `max_price`, `gender`, `brands`, `seasons`, `base_colors`, `secondary_colors`, `master_categories`, `sub_categories`, `article_types`, and selected product-name intent when it is clearly preference-like.

## Goals / Non-Goals

**Goals:**

- Detect clear preference signals from user messages and extracted solicitations.
- Track how often and how recently a user expresses or requests each learned value.
- Promote repeated or explicit signals into reviewable inferred preferences.
- Preserve the existing distinction between explicit, inferred, and conversation-temporary preferences.
- Keep current-request constraints stronger than learned memory in extraction, search, and response writing.
- Keep manually set user preferences stronger than automatically inferred preferences.
- Let conversation-temporary preferences outrank durable user memory only when they are scoped to the active conversation and do not conflict with the latest user message.
- Make learned memory explainable enough for users to trust and remove entries.

**Non-Goals:**

- Do not convert learned preferences into `search_preferences` priority fields.
- Do not treat every single product request as a durable style preference.
- Do not require a new vector database or external memory service.
- Do not personalize the same turn using signals learned from that turn.
- Do not silently override user-disabled personalization.
- Do not add hard filters for learned values unless the current request repeats them.

## Decisions

### Decision: Learn from signals, not directly from final preferences

Automatic memory should record granular observations first, then aggregate them into inferred preferences. A one-off request such as "show me a yellow jacket" is evidence, not immediately a durable preference.

Conceptual signal shape:

```json
{
  "user_id": "...",
  "conversation_id": "...",
  "message_id": "...",
  "field": "base_colors",
  "value": "black",
  "polarity": "positive",
  "strength": 0.35,
  "source": "request_field",
  "evidence": "User asked for black sneakers.",
  "observed_at": "..."
}
```

Rationale: granular signals make frequency and recency measurable, support debugging, and avoid pretending that every extracted field is a confirmed preference.

Alternatives considered:

- Append directly to `style_preferences.inferred`: rejected because it loses frequency, recency, and contradictory evidence.
- Store only an LLM-generated memory summary: rejected because it is hard to audit and update predictably.

### Decision: Separate explicit statements from repeated request behavior

Signals should carry a `source` and `strength` so the service can distinguish:

- explicit preferences: "I like minimalist outfits", "I prefer black", "I hate Nike"
- refinements/corrections: "make it black instead", "not Adidas"
- request behavior: "show me black sneakers", "find a formal outfit"
- temporary context: "for this chat, keep it formal"

Explicit preference statements should have higher strength than request behavior. Request behavior should require repetition before it becomes durable inferred memory.

Rationale: the user may search for a color, brand, category, or budget for a one-time need. Explicit language is a stronger personalization signal than a product constraint.

Alternatives considered:

- Learn only from explicit statements: safer but misses the requirement to track what users usually ask for.
- Learn equally from every extracted field: rejected because it over-personalizes quickly.

### Decision: Use frequency and recency to compute confidence

Aggregates should track at least:

- field and normalized value
- polarity
- total observation count
- weighted observation score
- first seen timestamp
- last seen timestamp
- recent observation count or decayed score
- confidence used by style context
- compact evidence summary for review

The scoring model can start simple and deterministic:

```text
score = explicit_signal_weight
      + log(1 + count) * frequency_weight
      + recency_decay(days_since_last_seen) * recency_weight
      - contradiction_penalty
```

Values should be promoted only when they pass conservative thresholds. Recent contradictions should reduce confidence or suppress promotion.

Rationale: frequency prevents one-off learning; recency prevents stale preferences from dominating future recommendations.

Alternatives considered:

- Use only count: rejected because old habits would remain too strong.
- Use only last seen: rejected because a single recent request would look too important.

### Decision: Use deterministic extraction from structured requests plus optional LLM classification for preference language

The learning service should use the already extracted `ItemSpecList` for catalog-backed fields. This provides a reliable source for values that product search already understands.

For preference language and polarity, a small structured LLM classifier can be added later or in the same implementation if needed. It should output candidate signals with fields, values, polarity, source, strength, and evidence. Low-confidence classifier output should be ignored.

Rationale: structured requests are already available in the graph state and reduce prompt/model dependency. LLM classification is useful for phrases like "I hate bright colors" that may not appear as simple positive request fields.

Alternatives considered:

- Only use an LLM over raw chat: rejected because it is harder to keep aligned with supported filter fields.
- Only use `ItemSpecList`: rejected because it cannot reliably distinguish "I want red today" from "I always prefer red".

### Decision: Learn after a successful turn and apply from the next turn onward

Preference learning should happen after the assistant has successfully processed and stored a user message and produced graph output. Signals from that message should not be injected into the same turn's `style_preference_context`.

```text
turn N input
    -> extract/search/respond using memory through N-1
    -> record signals from turn N
    -> update inferred memory
turn N+1 input
    -> may use updated memory
```

Rationale: this avoids self-reinforcing loops and preserves a clear boundary between current request and learned history.

Alternatives considered:

- Learn before search in the same turn: rejected because a current constraint could be mistaken for remembered memory.
- Batch offline learning only: safer but less responsive and more operationally complex.

### Decision: Learned preferences feed existing style context as soft guidance

The aggregate learned preferences should be exposed through the existing inferred preference path and style context. Product search should continue to treat them as soft semantic/ranking signals and skip learned color/brand guidance when the current request specifies those dimensions.

Rationale: this reuses existing precedence and ranking protections instead of creating a second personalization path.

Alternatives considered:

- Add learned values directly to `GarmentSpec`: rejected because it blurs current request and memory.
- Add hard database filters: rejected because learned preferences are not active constraints.

### Decision: Preserve source precedence across manual, learned, and conversation context

Automatic learning must not change the effective style context precedence introduced by `user-style-preferences`:

```text
latest user message / explicit chat instruction
        |
        v
relevant conversation-temporary preference
        |
        v
manual user explicit preference
        |
        v
automatically inferred user preference
        |
        v
defaults
```

Conversation-temporary preferences are stronger than durable user memory only when they are actually scoped to the active conversation, such as settings entered in the chat preference panel or an explicit in-chat instruction like "for this chat, keep it formal." They should not be promoted to durable memory unless the user clearly expresses them as general preferences, and they should not override a newer message in the same conversation.

Manual explicit preferences should fill gaps before learned preferences. If a user manually prefers Adidas but the learned aggregate suggests Nike, the effective context should prefer Adidas unless the latest chat request asks for Nike.

Rationale: this matches the natural assistant behavior expected from personalization: memory should help when the user is silent, but the assistant should still listen to what the user is asking for now.

Alternatives considered:

- Let learned preferences compete directly with manual preferences by confidence: rejected because user-managed settings are an explicit source of truth.
- Treat all conversation history as temporary preference context: rejected because ordinary old requests should be learned conservatively through the signal/aggregate path instead.

### Decision: Keep durable memory reviewable and deletable

User-facing inferred entries should show compact metadata such as value, kind/field, confidence, occurrence count, last seen date, and evidence summary. Removing an inferred preference should either suppress the aggregate or remove the promoted entry so it does not immediately reappear from old signals.

Rationale: automatic learning can surprise users. Review/removal is the trust boundary.

Alternatives considered:

- Hide learned metadata: rejected due to privacy and trust concerns.
- Delete all raw evidence on inferred removal by default: deferred; suppression may preserve analytics while respecting user-facing memory.

## Data Model Notes

The implementation can use relational tables for signal history and aggregate state, while continuing to publish promoted results through the existing JSON-backed style preferences API.

Suggested entities:

- `UserPreferenceSignal`: append-only observations tied to user, conversation, and optionally message.
- `UserPreferenceAggregate`: current aggregate per user/field/value/polarity with count, score, confidence, first/last seen, and suppression state.

The aggregate can periodically or synchronously update `style_preferences.inferred` so existing API/frontend surfaces continue to work. If JSON-only implementation is chosen for minimalism, it must still preserve count and last-seen metadata in each inferred entry.

## Risks / Trade-offs

- Noisy learned memory -> Use conservative thresholds, source weights, and contradiction suppression.
- Privacy concerns -> Show learned entries separately and allow removal/suppression.
- Prompt bloat -> Pass only top learned preferences above threshold into style context.
- Stale personalization -> Use recency decay and cap old low-score memories.
- Ambiguous shopping context -> Avoid durable learning from messages that indicate gifts, third-party shopping, or one-off events unless repeated.
- Schema complexity -> Keep the first signal/aggregate model small and service-owned.

## Migration Plan

1. Add preference signal and aggregate storage using the existing database migration pattern.
2. Preserve existing `style_preferences` JSON shape for explicit preferences and personalization toggles.
3. Extend inferred preference read models with optional count/last-seen metadata while tolerating missing fields.
4. If existing inferred entries exist, keep them readable and assign default count/confidence metadata only when needed.
5. Rollback is safe if new learning tables/fields are unused; explicit preferences and conversation behavior remain intact.

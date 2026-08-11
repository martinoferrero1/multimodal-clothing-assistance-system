## Why

The assistant currently supports explicit style preferences and has a reviewable `inferred` preference shape, but the system does not populate inferred preferences from normal chat usage. Users must manually configure preferences in the interface, so repeated patterns such as frequently requested colors, brands, categories, budgets, or occasions are not remembered automatically.

Users need the assistant to learn from clear preference statements and repeated product requests over time, while still keeping the current message authoritative. The system should understand both what a user commonly asks for and how recently those patterns appeared, so personalization can favor durable and fresh interests without turning old or one-off requests into hard constraints.

## What Changes

- Add automatic preference signal detection after message processing so user messages can contribute preference evidence for future turns.
- Track preference evidence for solicitation-backed fields such as gender, seasons, colors, brands, budget, usage, and product taxonomy values.
- Store enough history to evaluate frequency and recency instead of relying only on a flat inferred preference list.
- Aggregate signals into reviewable inferred preferences with confidence, evidence, occurrence counts, and last-seen metadata.
- Preserve the existing preference precedence: latest chat instructions first, then relevant conversation-temporary context, then manual user preferences, then automatically inferred preferences.
- Keep learned preferences as soft guidance and ensure the latest user request always overrides learned memory.
- Avoid storing ambiguous or low-confidence signals as durable preferences, especially when a request may be one-off or purchased for someone else.
- Expose learned preference metadata so users can inspect and remove automatically inferred entries.

## Capabilities

### New Capabilities
- `automatic-preference-detection`: Covers extracting preference signals from user messages, tracking frequency/recency, aggregating them into inferred memory, and applying them safely in future recommendations.

### Modified Capabilities
- `user-style-preferences`: Learned preferences should feed the existing inferred preference surface and effective style context without changing explicit preference behavior. Manually set explicit preferences remain stronger than automatically inferred preferences, while latest chat instructions remain authoritative over all stored memory.

## Impact

- Backend persistence: add storage for granular preference signals and/or aggregate learned preference statistics.
- Backend services: add a learning service that records signals, computes recency/frequency scores, and updates inferred preference memory.
- Runtime integration: invoke learning after a successful message turn using the user message, extracted solicitation, and graph output as context.
- Product search/personalization: use learned preferences only through existing soft style guidance and ranking paths.
- API/frontend: extend inferred preference read models enough to show why a preference was learned, how often it appeared, and when it was last observed.
- Tests: add service tests for signal extraction, aggregation, recency decay, conflict handling, and non-regression of current-request precedence.

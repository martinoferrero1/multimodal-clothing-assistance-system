## 1. Data Model And Schemas

- [x] 1.1 Add persistence for granular user preference signals tied to user, conversation, message, field, value, polarity, source, strength, evidence, and observed timestamp.
- [x] 1.2 Add persistence for aggregate learned preferences with count, weighted score, confidence, first seen, last seen, recent/decayed score, and suppression/removal state.
- [x] 1.3 Extend inferred style preference schemas with optional frequency/recency metadata while keeping existing reads backward-compatible.
- [x] 1.4 Add startup migrations for SQLite and PostgreSQL-compatible deployments.

## 2. Preference Learning Service

- [x] 2.1 Create a service that normalizes learnable fields and values from `GarmentSpec` and `OutfitSpec`.
- [x] 2.2 Detect request-behavior signals from extracted solicitations for supported fields: usage, max price, gender, brands, seasons, colors, and taxonomy values.
- [x] 2.3 Detect explicit positive/negative preference language from user messages with conservative confidence handling.
- [x] 2.4 Assign signal strength based on source type: explicit statement, correction/refinement, repeated request behavior, or temporary-only context.
- [x] 2.5 Ignore or downgrade ambiguous signals such as gifts, third-party shopping, one-off events, and low-confidence classifier output.
- [x] 2.6 Aggregate signals using frequency, recency decay, contradiction penalties, and promotion thresholds.
- [x] 2.7 Update or publish reviewable inferred preferences from aggregate state without changing explicit preferences.
- [x] 2.8 Suppress removed inferred preferences so old evidence does not immediately recreate them.
- [x] 2.9 Ensure learned aggregates never overwrite or replace manually set explicit preference fields.

## 3. Runtime Integration

- [x] 3.1 Capture enough graph/runtime output to learn from the current user message and extracted `ItemSpecList` after a successful turn.
- [x] 3.2 Invoke preference learning after the assistant response is generated and persisted, so learned signals affect future turns only.
- [x] 3.3 Ensure learning is skipped or limited when personalized style usage is globally disabled, according to the intended privacy behavior.
- [x] 3.4 Ensure conversation-temporary instructions remain conversation-scoped and are not promoted into durable memory unless clearly expressed as general preferences.

## 4. Effective Context And Recommendation Behavior

- [x] 4.1 Include only top promoted learned preferences in effective style context to avoid prompt bloat.
- [x] 4.2 Preserve current-request precedence when learned preferences conflict with explicit user constraints.
- [x] 4.3 Preserve source precedence in effective context: latest chat instruction, relevant conversation-temporary preference, manual explicit preference, learned inferred preference, defaults.
- [x] 4.4 Keep learned color, brand, budget, taxonomy, and occasion preferences as soft ranking/semantic guidance rather than hard filters.
- [x] 4.5 Update response writing guidance so the assistant may mention learned personalization at a high level without exposing raw signal details.

## 5. API And Frontend Transparency

- [x] 5.1 Return inferred preference metadata such as occurrence count, confidence, last seen date, and evidence summary in authenticated user reads.
- [x] 5.2 Update settings UI to display learned preference metadata clearly and separately from explicit preferences.
- [x] 5.3 Keep removal controls for inferred preferences and ensure removal suppresses regenerated entries from existing evidence.
- [x] 5.4 Consider whether users need a global toggle for learning separately from the existing toggle for using personalized styles.

## 6. Tests And Validation

- [x] 6.1 Add service tests for normalization of learnable fields and values from garment and outfit requests.
- [x] 6.2 Add tests proving one-off request fields do not immediately become durable inferred preferences.
- [x] 6.3 Add tests proving repeated requests increase count/confidence and recent signals outrank stale signals.
- [x] 6.4 Add tests for explicit positive and negative preference statements.
- [x] 6.5 Add tests for contradiction handling and suppression after inferred preference removal.
- [x] 6.6 Add tests proving current request constraints override learned memory in search and response behavior.
- [x] 6.7 Add tests proving manually set explicit preferences outrank automatically inferred preferences when the latest request is silent.
- [x] 6.8 Add tests proving relevant conversation-temporary preferences outrank durable user memory but not the latest explicit chat request.
- [ ] 6.9 Run `PYTHONPATH=src python -m pytest tests/`.
- [ ] 6.10 Run `npm run lint` from `src/frontend` if frontend files change.

## Context

The current `visual_similarity` implementation extracts uploaded-image features and compares them with catalog product images, but it only scores the top text-ranked candidates. For image-led prompts such as "quiero algo como esto", a visually similar product can be missed before visual scoring runs.

## Goals / Non-Goals

**Goals:**
- Use direct visual similarity as a primary retrieval signal when `IMAGE_SEARCH_MODE=visual_similarity` and uploaded-image features are available.
- Continue combining concrete text, extracted garment fields, priority fields, and semantic/text ranking with visual scores.
- Keep fallback behavior unchanged when image features or product image scores are unavailable.

**Non-Goals:**
- Add a frontend search-mode selector.
- Replace text and structured search constraints with image-only retrieval.
- Introduce a new multimodal embedding provider in this change.

## Decisions

1. Score visual similarity over the eligible product pool.

When priority fields produce enough matching products, those products form the eligible pool. Otherwise, the full product pool remains eligible. This lets visual similarity retrieve directly within the allowed constraints instead of only within a text-ranked slice.

Alternative considered: increase the text candidate limit. That still makes image retrieval dependent on text rank and does not match image-led prompts.

2. Combine visual and text scores after both are computed.

The final score remains additive: existing structured/text score plus `visual_similarity * IMAGE_VISUAL_SEARCH_WEIGHT`. This keeps concrete text such as color, category, price, gender, and priority fields active while allowing image similarity to dominate image-led requests.

Alternative considered: image-only ordering in visual mode. That would ignore useful text refinements like "like this but red".

3. Preserve current fallback behavior.

If visual scores cannot be computed, selection returns to the existing ranked text/semantic behavior.

## Risks / Trade-offs

- Scoring more product images can be slower when product visual features are not cached -> product-side features are persisted/cached and failures fall back to text ranking.
- Visual fingerprints are lightweight and imperfect -> text/structured scoring remains in the final score.
- Strict priority fields can exclude visually similar products -> this is intentional when users or config mark those fields as priority.

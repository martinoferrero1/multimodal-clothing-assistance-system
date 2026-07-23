## Why

Visual-similarity mode currently uses image similarity only as a late boost over a text-first candidate pool. For prompts like "quiero algo como esto" with an uploaded image, the image should be a primary retrieval signal while still respecting concrete text constraints.

## What Changes

- Change `visual_similarity` mode so image features are scored against the directly eligible catalog pool, not only the top text-ranked candidates.
- Keep concrete text and structured fields in the final score so requests like "algo como esto pero rojo" still combine image similarity with extracted constraints.
- Preserve priority fields as pre-selection constraints when enough products match, with fallback behavior when visual scoring is unavailable.
- Add tests that prove a visually similar product outside the top text-only slice can still be selected.

## Capabilities

### New Capabilities

### Modified Capabilities
- `image-search-modes`: Visual-similarity mode uses direct image similarity as a primary retrieval signal combined with text and structured ranking.

## Impact

- Affects backend product candidate ranking in `src/infra/db/product_search.py`.
- Affects tests around visual-similarity ranking.
- Does not change frontend payloads, API routes, or stored message attachment shape.

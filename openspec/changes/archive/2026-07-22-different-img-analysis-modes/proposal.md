## Why

Image-based product search currently depends on extracting textual characteristics from uploaded images and feeding those details into the existing catalog search. This is useful, but it does not support a backend-configurable mode that compares the uploaded image against catalog product imagery directly.

## What Changes

- Add backend configuration to select the image search strategy without requiring frontend changes.
- Keep the current characteristic-extraction behavior as the default mode.
- Add an alternate visual-similarity mode that compares uploaded image content against product images and uses those scores during product candidate ranking.
- Preserve existing text and semantic search fallbacks when visual comparison cannot produce usable scores.
- Persist or cache reusable product-side visual data so repeated visual searches do not recompute all catalog image features.

## Capabilities

### New Capabilities
- `image-search-modes`: Backend-configurable image search modes for characteristic-based and visual-similarity product search.

### Modified Capabilities

## Impact

- Affects backend settings, image attachment processing, graph state, and product candidate ranking.
- May add a backend image-processing dependency for local visual feature extraction or comparison.
- Does not require frontend API or UI changes for this phase.
- Does not introduce breaking changes; the default mode remains the existing characteristic-based flow.

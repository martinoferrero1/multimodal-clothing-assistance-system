## Context

The backend currently supports image-assisted product search by analyzing uploaded images with the configured image analysis model, converting the result into textual visual characteristics, and passing those details through the existing outfit extraction and product ranking flow. Product records already contain image URL fields, but image uploads are not compared directly against catalog imagery.

This change introduces a backend-only strategy switch. The frontend continues uploading images exactly as it does today. The backend decides whether image attachments contribute only textual characteristics or also visual similarity scores.

## Goals / Non-Goals

**Goals:**
- Provide a backend configuration value that selects the image search mode.
- Preserve the existing characteristic-based behavior as the default.
- Add a visual-similarity mode that compares uploaded images to catalog product images and influences candidate ranking.
- Keep the search resilient by falling back to the current semantic/text ranking when visual comparison is unavailable.
- Avoid frontend API, UI, or request payload changes.

**Non-Goals:**
- Add a frontend control for selecting search mode.
- Replace the existing outfit request extraction, semantic search, or product ranking pipeline.
- Guarantee perfect visual matching; this phase introduces a configurable comparison path that can be improved independently.
- Require a full catalog migration before the backend can start.

## Decisions

1. Use a settings-driven mode switch.

`IMAGE_SEARCH_MODE` selects between `characteristics` and `visual_similarity`. The default remains `characteristics` so existing deployments keep current behavior unless explicitly configured otherwise.

Alternatives considered: expose a frontend toggle or per-request API flag. Those were rejected for this phase because the requirement is backend-only configuration.

2. Keep characteristic extraction in the image flow.

Even when visual similarity is enabled, the backend continues generating textual image descriptions for outfit extraction. Visual similarity is an additional ranking signal, not a replacement for understanding garment category, color, price, gender, or other constraints.

Alternatives considered: bypass extraction and search only by image similarity. That would reduce the value of existing filters and structured product solicitation.

3. Apply visual similarity during candidate selection.

The product search flow first computes the existing semantic/textual ranking and priority filtering. In visual mode, the backend computes product image similarity for a bounded candidate pool and reorders candidates using a configurable visual weight.

Alternatives considered: compare the upload against the entire catalog before text ranking. That is more expensive and risks returning visually similar but semantically irrelevant products.

4. Persist reusable product visual features.

Product-side image features are cached or persisted using the existing product embedding storage pattern where practical. Uploaded image features remain per-request and are not persisted.

Alternatives considered: recompute product image features on every search. That is simpler but inefficient for repeated catalog searches.

## Risks / Trade-offs

- Visual comparison can be slow when many product images lack cached features → Limit visual scoring to a bounded candidate pool and cache product-side features.
- Product image URLs can be missing, stale, or unreachable → Fall back to the existing ranking when visual scores cannot be computed.
- Local image fingerprints are less semantically rich than model-based multimodal embeddings → Keep the implementation isolated behind a service so the comparison backend can be upgraded later.
- Visual scores could overpower structured constraints → Apply visual scoring after priority filtering and expose a configurable weight.

## Migration Plan

- Add settings with defaults that preserve existing behavior.
- Add the visual similarity service and integrate it into conversation runtime and product search state.
- Add or update tests around mode selection and visual scoring behavior.
- Deploy with `IMAGE_SEARCH_MODE=characteristics` by default.
- Enable `IMAGE_SEARCH_MODE=visual_similarity` only when the image-processing dependency and catalog image access are available.
- Roll back by setting `IMAGE_SEARCH_MODE=characteristics`.

## Open Questions

- Whether visual comparison should eventually use provider-native multimodal embeddings instead of local image fingerprints.
- Whether product image features should move to a dedicated table if multiple visual feature providers or versions are introduced.
- Whether future frontend controls should allow per-conversation or per-request mode selection.

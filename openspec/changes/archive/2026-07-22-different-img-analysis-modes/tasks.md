## 1. Configuration And State

- [x] 1.1 Add backend settings for `IMAGE_SEARCH_MODE`, visual candidate pool size, visual score weight, image fetch timeout, and maximum downloaded image size.
- [x] 1.2 Extend graph state to carry per-request visual image features from message processing into product search.
- [x] 1.3 Ensure `characteristics` remains the default mode when no setting is provided.

## 2. Image Processing Services

- [x] 2.1 Keep the existing image analysis service behavior for characteristic extraction and attachment metadata.
- [x] 2.2 Add a visual similarity service that extracts visual features from uploaded image attachments only when visual mode is active.
- [x] 2.3 Add product image feature extraction using catalog image URLs with bounded download size and timeout handling.
- [x] 2.4 Persist or cache product visual features with source-image staleness detection.

## 3. Product Search Integration

- [x] 3.1 Pass visual image features from conversation runtime into the supervisor graph and product candidate search.
- [x] 3.2 Reorder a bounded pool of existing ranked product candidates using visual similarity scores when visual mode is active.
- [x] 3.3 Preserve priority fields, semantic ranking, text ranking, and fallback behavior when visual scores are missing or unavailable.
- [x] 3.4 Include search mode metadata in candidate results for observability.

## 4. Tests And Verification

- [x] 4.1 Add unit tests for visual feature extraction mode gating.
- [x] 4.2 Add unit tests showing identical images score higher than visually different images.
- [x] 4.3 Run backend syntax checks and available tests with `PYTHONPATH=src`.
- [x] 4.4 Document any local dependency gaps that prevent running the full test suite.

Verification note: `PYTHONPATH=src python -m compileall -q src/api src/agents src/core src/infra src/schemas src/services src/utils src/state.py tests` passed. `PYTHONPATH=src python -m pytest tests/` could not run because `pytest` is not installed. `PYTHONPATH=src python -m unittest discover tests` was attempted but this Python environment is missing `pydantic` and `PIL`/Pillow.

## 1. Product Search Ranking

- [x] 1.1 Change visual-similarity mode to score the eligible product pool directly instead of only the top text-ranked slice.
- [x] 1.2 Keep text, semantic, structured, and priority-field scoring in the final ranking.
- [x] 1.3 Preserve fallback to existing ranking when visual scores are unavailable.

## 2. Tests And Verification

- [x] 2.1 Add a unit test showing visual mode can select a visually similar product outside the text-only top slice.
- [x] 2.2 Run backend syntax checks and available tests with `PYTHONPATH=src`.

Verification note: `PYTHONPATH=src python -m compileall -q src\api src\agents src\core src\infra src\schemas src\services src\utils src\state.py tests` passed. `openspec validate direct-image-similarity-search` passed. `PYTHONPATH=src python -m unittest discover tests` was attempted but this Python environment is missing required dependencies: `pydantic`, `PIL`/Pillow, and `sqlalchemy`.

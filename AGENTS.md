# AGENTS.md

## Running the backend locally

`PYTHONPATH` must include `src` — all backend imports are relative to `src/`.

```powershell
# PowerShell (Windows)
$env:PYTHONPATH="src"
uvicorn api.app:app --host 0.0.0.0 --port 8000
```

```bash
# Linux/macOS
PYTHONPATH=src uvicorn api.app:app --host 0.0.0.0 --port 8000
```

## Running the full stack

```bash
docker compose up --build
```

Services: API (`:8000`), Frontend (`:3000`), PostgreSQL (`:5432`).

## Frontend

Located in `src/frontend/` (separate `package.json`).

```bash
cd src/frontend
npm run dev    # dev server
npm run lint   # eslint (next/core-web-vitals)
npm run build  # production build
```

The frontend proxies all `/api/proxy/...` requests to the backend via `API_BASE_URL` (defaults to `http://127.0.0.1:8000`).

## Tests

One test file exists: `tests/test_image_analysis_service.py` (unittest). Run with:

```bash
PYTHONPATH=src python -m pytest tests/   # or python -m unittest
```

No backend lint/typecheck tooling is configured. No CI workflows exist.

## Catalog seeding

`scripts/seed_db.py` auto-seeds `data/clothes.csv` (~44k products) on first run. If the `products` table already has rows, seeding is skipped. Deleting the DB file (or dropping the table) re-triggers seeding.

## Key architecture notes

- **Agent graph**: `src/agents/main_supervisor_agent/graph.py` — LangGraph supervisor with specialized nodes (orchestrator, extractor, search, business QA, outfit builder, response writer).
- **State**: `src/state.py` — `StateKeys` / `SumaryKeys` constants used everywhere; prefer referencing these over raw strings.
- **Prompts**: `src/prompts/` — one directory per node responsibility. Toggle examples with `INCLUDE_PROMPT_EXAMPLES`.
- **Provider system**: `src/infra/providers/factories/` — `GoogleFactory` and `GroqFactory` selected via `LLM_SUPERVISOR_PROVIDER`, `LLM_SUB_AGENTS_PROVIDER`, `EMBEDDINGS_PROVIDER`. Groq does **not** support embeddings — always set `EMBEDDINGS_PROVIDER=google`.
- **Settings**: `src/core/settings.py` — Pydantic Settings loaded from `.env` at module import time (`settings` singleton). Validates API keys/providers on startup.
- **Database**: `src/infra/db/database.py` — singleton `Database` class. Auto-creates tables via `Base.metadata.create_all` and runs schema migrations in `_ensure_chat_schema`. Supports SQLite (local) and PostgreSQL (Docker).
- **Error handling**: Graph nodes wrap calls in `safe_node` (`src/utils/error_handling.py`); errors append to `state["errors"]` as `{node, message, type}` dicts.
- **Auth**: Custom HMAC bearer tokens (no external provider). Passwords hashed with `hashlib.scrypt`.
- **Business RAG**: `data/business_knowledge/*.knowledge.md` → FAISS index at `data/business_knowledge_index/`. Index is rebuilt from docs if missing/stale.

## .env and secrets

`.env` is gitignored. The root `.env` contains real API keys — never commit it. The Docker Compose setup reads from the host `.env` via `${VAR}` interpolation.

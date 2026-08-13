# AGENTS.md

## Product naming

The public application name is **Lookeate**. Use Lookeate in user-facing UI,
documentation, specs, and new product copy. **Lookeate Assistant** is the public
name of the conversational styling module. Generic terms like "assistant" may
still describe technical chat roles, agent responsibilities, or internal
architecture.

## Running the backend locally

`PYTHONPATH` must include `src` because backend imports are relative to `src/`.

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
npm run lint   # eslint
npm run build  # production build
```

The frontend proxies all `/api/proxy/...` requests to the backend via
`API_BASE_URL` (defaults to `http://127.0.0.1:8000`).

Current workspace UI notes:

- The authenticated default route is the Lookeate home. It presents Lookeate
  Assistant as available and the garment creator, manual style creator, and
  catalog explorer as visible but inaccessible upcoming modules.
- The Beta status belongs to Lookeate as a whole and is presented on the home,
  not beside the Lookeate Assistant identity.
- Lookeate Assistant owns the collapsible conversation sidebar and chat history.
  The former "Create your style" placeholder does not appear in that sidebar.
- Global Settings is presented as a modal from the workspace shell.
- Settings separates General, Lookeate Assistant, and Account. General contains
  only the application language; Assistant contains chat layout,
  recommendation, search-priority, and style-memory preferences.
- The left sidebar is collapsible on desktop and drawer-based on smaller screens.
- Interface preferences live in browser `localStorage` and dispatch
  `preferences:changed` when updated.
- Chat recommendations render product groups inline.
- Outfit cards open in the recommendation side panel when enabled and available;
  otherwise they open in a modal.
- Disabling the recommendation panel from Settings must clear any active outfit
  selection/marking so modal mode does not inherit stale panel state.

## Tests

Backend tests live in `tests/`. Run with:

```bash
PYTHONPATH=src python -m pytest tests/
```

Current test files cover image analysis, visual similarity ranking, preference
learning, product visual ranking, and style preference behavior.

No backend lint/typecheck tooling is configured. No CI workflows exist.

## Catalog seeding

`scripts/seed_db.py` auto-seeds `data/clothes.csv` (~44k products) on first run.
If the `products` table already has rows, seeding is skipped. Deleting the DB
file (or dropping the table) re-triggers seeding.

## Key architecture notes

- **Agent graph**: `src/agents/main_supervisor_agent/graph.py` - LangGraph
  supervisor with specialized nodes (orchestrator, extractor, search, business
  QA, outfit builder, response writer).
- **State**: `src/state.py` - `StateKeys` / `SumaryKeys` constants used
  everywhere; prefer referencing these over raw strings.
- **Prompts**: `src/prompts/` - one directory per node responsibility. Toggle
  examples with `INCLUDE_PROMPT_EXAMPLES`.
- **Provider system**: `src/infra/providers/factories/` - `GoogleFactory` and
  `GroqFactory` selected via `LLM_SUPERVISOR_PROVIDER`,
  `LLM_SUB_AGENTS_PROVIDER`, `EMBEDDINGS_PROVIDER`. Groq does **not** support
  embeddings; always set `EMBEDDINGS_PROVIDER=google`.
- **Settings**: `src/core/settings.py` - Pydantic Settings loaded from `.env` at
  module import time (`settings` singleton). Validates API keys/providers on
  startup.
- **Database**: `src/infra/db/database.py` - singleton `Database` class.
  Auto-creates tables via `Base.metadata.create_all` and runs schema migrations
  in `_ensure_chat_schema`. Supports SQLite (local) and PostgreSQL (Docker).
- **Error handling**: Graph nodes wrap calls in `safe_node`
  (`src/utils/error_handling.py`); errors append to `state["errors"]` as
  `{node, message, type}` dicts.
- **Auth**: Custom HMAC bearer tokens (no external provider). Passwords hashed
  with `hashlib.scrypt`.
- **Business RAG**: `data/business_knowledge/*.knowledge.md` -> FAISS index at
  `data/business_knowledge_index/`. Index is rebuilt from docs if missing/stale.

## .env and secrets

`.env` is gitignored. The root `.env` contains real API keys; never commit it.
The Docker Compose setup reads from the host `.env` via `${VAR}` interpolation.

# Lookeate

Lookeate is an in-progress modular platform for creating, combining, and
discovering personal style. Its authenticated home brings several experiences
together: a conversational styling assistant, hands-on garment creation,
manual outfit composition, and structured exploration of client catalogs.

> Status: the complete Lookeate product is in beta. Lookeate Assistant,
> authentication, conversation persistence, business-information RAG,
> text/image-assisted product search, user style preferences, and the new
> authenticated home are implemented. The garment creator, manual style
> creator prototype, and structured catalog explorer are represented on Home.
> The manual style creator is available as an interactive base; the garment
> creator and catalog explorer are not accessible yet.

## Project Vision

The goal is to give users complementary ways to shape their style instead of
forcing every task through a single interface. The home organizes four product
experiences:

- **Lookeate Assistant** (available): natural-language and image-assisted
  conversations for ideas, garment discovery, outfits, and store questions.
- **Create a garment** (coming soon): hands-on editing of garment types, cuts,
  colors, and details.
- **Create your style** (base available): manual outfit composition on a
  lightweight rotatable mannequin, piece by piece.
- **Explore catalogs** (coming soon): ecommerce-style searches across specific
  client catalogs with structured categories and filters.

In Lookeate Assistant, users can describe what they need naturally:

- "I need an outfit for a wedding, with a red dress and formal accessories."
- "I am looking for grey men's sports shoes, preferably from FILA."
- "What payment methods do you accept?"
- "I want a tennis outfit with sneakers, a T-shirt, and shorts."

Lookeate Assistant interprets the user's intent, decides which capabilities are
needed, retrieves store information when relevant, searches the catalog, and
returns a structured answer with recommendations ready to be rendered in the
frontend.

The multimodal flow lets users upload reference images or similar products to
improve search and recommendations. Uploaded images are accepted by the chat API,
analyzed by the configured image provider, and combined with structured request
extraction and catalog search. Product records include multiple image
references, and the frontend renders product and outfit recommendations with
their available images.

## Implemented Features

- Authenticated Lookeate home as the default destination.
- Product-level Beta messaging and a four-experience module overview.
- Lookeate Assistant as the available conversational experience, with a direct
  path back to Home.
- Base Create your style studio with a rotatable CSS 3D mannequin, garment
  categories, layer selection, and a current-look summary.
- Upcoming garment creation and structured catalog exploration presented
  without navigable controls.
- Authenticated chat with registration, login, and browser-persisted sessions.
- Per-user conversation history.
- Conversation creation, retrieval, and deletion.
- Persistent user and assistant messages.
- Assistant responses with structured payloads for the frontend.
- Chat image uploads for multimodal recommendation turns.
- Visual recommendation surfaces for products and outfits, including a desktop
  side panel and modal fallback.
- User style preferences with explicit, inferred, temporary conversation, and
  personalization toggle support.
- LangGraph-based agent orchestration.
- Conversation checkpoints by `thread_id`.
- Incremental summarization for longer conversations.
- RAG over internal store/business documents.
- FAISS index for business knowledge.
- Product search from natural language using embeddings and attribute scoring.
- Structured extraction of garment and outfit requests with Pydantic.
- Catalog taxonomy normalization.
- Automatic catalog seeding from CSV.
- SQLite support for local development and PostgreSQL support for Docker
  Compose deployments.
- Next.js frontend with Home, Lookeate Assistant, upload controls, an
  Assistant-specific collapsible sidebar, conversation history, login,
  register, a reusable settings modal, and UI preferences.

## In Development / Roadmap

- Hands-on garment creation and editing.
- Persistent saved looks and a production 3D fitting model for manual style
  composition.
- Structured ecommerce-style exploration of client-specific catalogs.
- Stronger multimodal image embeddings for visual search quality.
- Saving personalized outfits as dedicated database entities.
- Editing previously saved outfits.
- Favorites, collections, or wishlist flows.
- More guided onboarding for creating and tuning style preferences.
- Dedicated endpoints for outfit management.
- Improved stock/availability and real pricing logic.
- Broader frontend test coverage and CI automation.

## Architecture Overview

The system is organized into three main layers:

```text
User
  |
  v
Next.js Frontend
  |
  +--> Lookeate Home
  |      +--> Lookeate Assistant (available)
  |      +--> Create a garment (coming soon)
  |      +--> Create your style (base available)
  |      `--> Explore catalogs (coming soon)
  |
  v
Lookeate Assistant
  |
  v
FastAPI API -> LangGraph Supervisor Agent
  |
  +--> Business QA RAG
  |      +--> Markdown knowledge docs
  |      +--> FAISS index
  |      +--> Embeddings provider
  |
  +--> Outfit request extractor
  |      +--> Structured Pydantic schemas
  |      +--> Catalog taxonomy
  |
  +--> Product search
  |      +--> SQLAlchemy catalog DB
  |      +--> Semantic similarity
  |      +--> Attribute scoring
  |
  +--> Outfit recommendation builder
  |
  +--> Final response writer
         +--> Text response
         +--> Structured UI payload
```

## Tech Stack

### Backend

- Python 3.11
- FastAPI
- Uvicorn
- SQLAlchemy
- SQLite / PostgreSQL
- Pydantic and Pydantic Settings
- LangGraph
- LangChain Core
- LangChain Google GenAI
- LangChain Groq
- FAISS
- Pandas / NumPy

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Lucide React
- date-fns

### Infrastructure

- Docker
- Docker Compose
- PostgreSQL 16 Alpine
- Persistent database volume
- Persistent FAISS business-knowledge index volume

## Project Structure

```text
.
|-- data/
|   |-- business_knowledge/
|   |   |-- *.knowledge.md
|   |   `-- README.md
|   |-- catalog_taxonomy_nested.json
|   |-- clothes.csv
|   |-- images.csv
|   |-- styles.csv
|   `-- styles/
|       `-- *.json
|-- scripts/
|   `-- seed_db.py
|-- src/
|   |-- agents/
|   |   |-- base_graph.py
|   |   `-- main_supervisor_agent/
|   |       `-- graph.py
|   |-- api/
|   |   |-- app.py
|   |   |-- checkpointer.py
|   |   |-- dependencies.py
|   |   |-- route_helpers.py
|   |   |-- schemas.py
|   |   `-- routes/
|   |-- core/
|   |   |-- settings.py
|   |   `-- metaclasses/
|   |-- frontend/
|   |   |-- app/
|   |   |-- components/
|   |   |-- lib/
|   |   |-- package.json
|   |   `-- next.config.ts
|   |-- infra/
|   |   |-- db/
|   |   `-- providers/
|   |-- prompts/
|   |-- schemas/
|   |-- services/
|   |-- state.py
|   `-- utils/
|-- docker-compose.yml
|-- Dockerfile
|-- main.py
|-- requirements.txt
`-- README.md
```

## Backend

The backend exposes a FastAPI application defined in `src/api/app.py`. During
the application lifespan it:

1. Initializes database connections without creating or altering schema.
2. Requires the database to be at the repository Alembic head.
3. Runs the provider-readiness integration gate when configured.
4. Runs `seed_catalog()` to load the catalog when it is still empty.
5. Starts the already-provisioned LangGraph checkpointer and builds the runtime.
6. Disposes database/checkpointer resources on shutdown.

Schema migration and LangGraph checkpoint setup are explicit operations. See
[`documentation/database_migrations.md`](documentation/database_migrations.md)
for blank setup, legacy adoption, release order, and recovery procedures.

### Main Routes

Health:

- `GET /`
- `GET /health`

Authentication:

- `POST /api/auth/register`
- `POST /api/auth/login`

Users:

- `GET /api/users/me`
- `GET /api/users/{user_id}`
- `PUT /api/users/me/search-preferences`
- `PUT /api/users/me/style-preferences`
- `DELETE /api/users/me/style-preferences/explicit`
- `DELETE /api/users/me/style-preferences/inferred/{inferred_id}`
- `POST /api/users/me/conversations`
- `GET /api/users/me/conversations`
- `DELETE /api/users/me/conversations`

Conversations:

- `GET /api/conversations/{conversation_id}`
- `GET /api/conversations/{conversation_id}/messages`
- `PUT /api/conversations/{conversation_id}/search-preferences`
- `PUT /api/conversations/{conversation_id}/style-preferences`
- `POST /api/conversations/{conversation_id}/messages`
- `POST /api/conversations/{conversation_id}/messages/with-images`
- `POST /api/conversations/{conversation_id}/messages/stream`
- `DELETE /api/conversations/{conversation_id}`

## Agent and Conversation Flow

The AI core lives in `src/agents/main_supervisor_agent/graph.py`. It uses
LangGraph to compile a workflow with specialized nodes.

### Graph Nodes

- `orchestator_planner`: decides which steps to run for the user's message.
- `plan_router`: advances through the generated plan.
- `extract_outfit_request`: extracts garments, outfits, and attributes.
- `search_products`: searches catalog candidates.
- `business_qa`: answers store-information questions with RAG.
- `build_outfit`: builds garment and outfit recommendations.
- `final_response`: writes the final answer and structured payload.
- `ask_for_feedback`: interruption point used to continue the conversation.

### Orchestrator Decisions

The `OrchestatorDecision` schema lets the supervisor choose whether to:

- answer directly;
- ask for clarification;
- retrieve business information;
- extract a product search request;
- build outfits;
- combine business Q&A and recommendations in a single response.

This allows a single user message to combine multiple needs, such as:
"What payment methods do you accept, and I also want a tennis outfit."

## Product Search

Product search is implemented in `src/infra/db/product_search.py`.

The current flow:

1. The agent extracts a structured request (`GarmentSpec`, `OutfitSpec`).
2. A semantic query string is built from categories, colors, usage, gender,
   brands, season, and product names.
3. The query embedding is computed, while catalog product embeddings are loaded from the database or computed and persisted when missing/stale.
4. Semantic scores are combined with attribute-based matching.
5. The best candidates are returned per requested garment.

The scoring considers:

- semantic similarity;
- master category;
- subcategory;
- article type;
- primary color;
- secondary colors;
- gender;
- season;
- year proximity;
- maximum price.

Search can optionally apply priority filters before ranking. Defaults come from
`PRODUCT_SEARCH_PRIORITY_FIELDS`, while individual `GarmentSpec` or `OutfitSpec`
objects can override them with `priority_fields`. If a priority-filtered search
does not return enough products, matching priority products are kept first and
the remaining slots are filled with the traditional ranking.

Each result includes product data, price, brand, category, color, season, score,
and available product images.

## Outfit Recommendations

Recommendations are normalized by `OutfitRecommendationService`.

The system can return:

- individual garments;
- outfits composed of multiple garments;
- best match per garment;
- highlighted product groups;
- summary labels for the UI;
- structured payloads for visual rendering.

The final payload is defined in
`src/schemas/outfit_maker/recommendation_response.py` and includes:

- `message`: final text response;
- `sections`: renderable response sections;
- `recommendations`: garments, outfits, and highlighted products;
- `business_answer_texts`: business answers used in the final response.

## Business Information RAG

Business Q&A lives under `src/services/business_qa/`.

Source documents are stored in:

```text
data/business_knowledge/
```

Current documents cover:

- general store overview;
- product categories;
- availability;
- sizing and fit;
- shipping;
- returns;
- payment methods;
- customer support.

The system:

1. Reads `*.knowledge.md` files.
2. Splits content into chunks.
3. Generates embeddings.
4. Builds a FAISS index.
5. Retrieves relevant chunks for each question.
6. Generates an answer grounded in those documents.

The index is stored by default in:

```text
data/business_knowledge_index/
```

## Database

The project uses SQLAlchemy with support for SQLite and PostgreSQL.

### Catalog Models

Defined in `src/infra/db/models/catalog_models.py`:

- `Gender`
- `MasterCategory`
- `SubCategory`
- `ArticleType`
- `Color`
- `Brand`
- `Season`
- `Product`

The `Product` model includes:

- display name;
- year;
- usage;
- price;
- gender;
- master category;
- subcategory;
- article type;
- brand;
- season;
- base color;
- secondary colors;
- image URLs or references from several views.

### Chat Models

Defined in `src/infra/db/models/chat_models.py`:

- `ChatUser`
- `Conversation`
- `ChatMessage`

Each conversation belongs to a user and stores its title, summary, timestamps,
and related messages. Each message may also store:

- `final_response_payload`;
- `workflow_errors`.

### Catalog Data

The main dataset is:

```text
data/clothes.csv
```

It contains 44446 products with fields such as:

- `id`
- `gender`
- `masterCategory`
- `subCategory`
- `articleType`
- `baseColour`
- `season`
- `year`
- `usage`
- `productDisplayName`
- `brand`
- product images by view

There are also 44446 JSON files in `data/styles/` and auxiliary files such as
`styles.csv`, `images.csv`, and `catalog_taxonomy_nested.json`.

Automatic seeding is implemented in:

```text
scripts/seed_db.py
```

If the product table already contains records, seeding is skipped.

## Frontend

The frontend lives in `src/frontend` and uses the Next.js App Router.

Main screens and components:

- Login and registration.
- Session-aware routing to the authenticated Home by default.
- Editorial dark Home with a global Beta notice and four product experiences;
  Lookeate Assistant and Create your style are currently actionable.
- Create your style studio with a rotatable mannequin, a side garment library,
  selectable top/bottom/shoe layers, and an outfit progress summary. This base
  is intentionally client-side and does not persist looks yet.
- Lookeate Assistant workspace with a collapsible, Assistant-specific sidebar,
  conversation history, and a route back to Home. "Create your style" is no
  longer shown as a chat-sidebar placeholder.
- Main Assistant conversation surface with image attachments, centered
  GPT-style message flow, and structured recommendation rendering.
- Product recommendation groups shown directly inside assistant messages.
- Outfit recommendation cards that open a desktop side panel when enabled, or a
  dedicated modal when panel mode is disabled or unavailable.
- Settings modal, available from Home and Lookeate Assistant, for global
  configuration. Its General section currently contains only language;
  Assistant-specific layout, recommendation, search-priority, and style-memory
  preferences live in a dedicated Lookeate Assistant section, while profile
  details remain under Account.
- Conversation settings modal for temporary style notes, conversation-level
  personalization override, and conversation-specific search priorities.

Interface preferences are stored in browser `localStorage`; changes dispatch a
`preferences:changed` browser event so the sidebar, settings modal, and chat
workspace stay synchronized. Disabling the recommendation panel clears any
currently marked outfit selection and future outfit cards open in the modal
surface instead.

The client communicates with the backend through an internal proxy:

```text
src/frontend/app/api/proxy/[...path]/route.ts
```

This lets the browser call relative routes such as `/api/proxy/...` while Next.js
forwards the request to the backend configured with `API_BASE_URL`.

## Environment Variables

The backend reads configuration from `.env` using Pydantic Settings.

Example local configuration:

```env
APP_ENV=local
DATABASE_URL=sqlite:///catalog.db
LANGGRAPH_CHECKPOINT_DATABASE_URL=sqlite:///data/langgraph_checkpoints.sqlite

AUTH_TOKEN_SECRET=change-this-secret
AUTH_TOKEN_EXPIRE_MINUTES=60
GOOGLE_IMAGE_ANALYSIS_MODEL=gemini-2.5-flash

LLM_SUB_AGENTS_PROVIDER=google
LLM_SUPERVISOR_PROVIDER=google
EMBEDDINGS_PROVIDER=google
IMAGE_ANALYSIS_PROVIDER=google

GOOGLE_LLM_MODEL=gemini-2.0-flash
GOOGLE_EMBEDDING_MODEL=gemini-embedding-001
GOOGLE_API_KEY=your-google-api-key

GROQ_LLM_MODEL=llama-3.3-70b-versatile
GROQ_API_KEY=your-groq-api-key

INCLUDE_PROMPT_EXAMPLES=false
PRODUCT_SEARCH_PRIORITY_FIELDS=
IMAGE_SEARCH_MODE=characteristics
IMAGE_VISUAL_SEARCH_CANDIDATE_LIMIT=80
IMAGE_VISUAL_SEARCH_WEIGHT=10.0
IMAGE_VISUAL_SEARCH_FETCH_TIMEOUT_SECONDS=3.0
IMAGE_VISUAL_SEARCH_MAX_IMAGE_BYTES=5242880
```

Relevant variables:

- `APP_ENV`: required runtime mode: `local`, `test`, `staging`, or `production`.
- `DATABASE_URL`: main SQLAlchemy database connection.
- `DATABASE_ECHO`: enables SQL logs.
- `LANGGRAPH_CHECKPOINT_DATABASE_URL`: database for LangGraph checkpoints.
- `AUTH_TOKEN_SECRET`: HMAC secret for bearer tokens.
- `AUTH_TOKEN_EXPIRE_MINUTES`: token duration in minutes.
- `GOOGLE_IMAGE_ANALYSIS_MODEL`: Google Gemini model used to describe uploaded images for visual product search.
- `GOOGLE_LLM_MODEL`: Google chat model.
- `GROQ_LLM_MODEL`: Groq chat model.
- `GOOGLE_EMBEDDING_MODEL`: embedding model.
- `LLM_SUB_AGENTS_PROVIDER`: provider for sub-agents.
- `LLM_SUPERVISOR_PROVIDER`: provider for the supervisor.
- `EMBEDDINGS_PROVIDER`: provider for embeddings.
- `IMAGE_ANALYSIS_PROVIDER`: provider for image analysis. Currently, `google` is supported.
- `IMAGE_SEARCH_MODE`: image search strategy. Use `characteristics` to search from analyzed image text, or `visual_similarity` to combine direct catalog image similarity with text and structured ranking.
- `IMAGE_VISUAL_SEARCH_CANDIDATE_LIMIT`: fallback candidate count used by the text-ranking path when priority filters do not produce enough products.
- `IMAGE_VISUAL_SEARCH_WEIGHT`: weight applied to direct visual similarity scores.
- `IMAGE_VISUAL_SEARCH_FETCH_TIMEOUT_SECONDS`: timeout for downloading catalog product images during visual feature extraction.
- `IMAGE_VISUAL_SEARCH_MAX_IMAGE_BYTES`: maximum catalog image download size for visual feature extraction.
- `INCLUDE_PROMPT_EXAMPLES`: includes prompt examples where supported.
- `PRODUCT_SEARCH_PRIORITY_FIELDS`: optional comma-separated product search priority fields. Supported values are `gender`, `season`, `base_colors`, `secondary_colors`, `max_price`, and `category`. Category priority uses the deepest available request taxonomy field among article type, subcategory, and master category.
- `BUSINESS_KNOWLEDGE_DIR`: RAG document folder.
- `BUSINESS_KNOWLEDGE_GLOB`: RAG document glob pattern.
- `BUSINESS_FAISS_INDEX_DIR`: FAISS index output directory.
- `BUSINESS_RAG_CHUNK_SIZE`: chunk size.
- `BUSINESS_RAG_CHUNK_OVERLAP`: chunk overlap.
- `BUSINESS_RAG_TOP_K`: number of retrieved chunks.
- `BUSINESS_RAG_MIN_SCORE`: minimum retrieval score.

Note: Groq is implemented for chat in this project, but not for embeddings.
Use `EMBEDDINGS_PROVIDER=google` for embeddings.

## Running with Docker Compose

On a first run with a blank PostgreSQL volume, initialize the schemas before
starting the full stack. The API intentionally does not run migrations or
create tables during startup:

```bash
docker compose up -d db
docker compose run --rm --build api python -m alembic upgrade head
docker compose run --rm api python -m scripts.setup_langgraph_checkpointer
docker compose up --build
```

After that initial setup, start the full stack normally:

```bash
docker compose up --build
```

If the PostgreSQL volume was created by a Lookeate version from before
Alembic, do not run the blank-database sequence directly. Back it up and use
the Docker legacy-adoption procedure in
`documentation/database_migrations.md` so the existing rows are preserved.

Services:

- API: `http://localhost:8000`
- Frontend: `http://localhost:3000`
- PostgreSQL: `localhost:5432`

Docker Compose starts:

- `db`: PostgreSQL 16.
- `api`: FastAPI with Uvicorn.
- `frontend`: Next.js in development mode.

The Compose setup configures the API to use PostgreSQL:

```text
DATABASE_URL=postgresql+psycopg://clothing_assistant:clothing_assistant@db:5432/clothing_assistant
LANGGRAPH_CHECKPOINT_DATABASE_URL=postgresql://clothing_assistant:clothing_assistant@db:5432/clothing_assistant
```

## Running Locally Without Docker

### Backend

Create and activate a virtual environment:

```bash
python -m venv .venv
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Configure `.env` in the project root.

Initialize the application and LangGraph-owned schemas, then optionally seed
the catalog:

```bash
APP_ENV=local PYTHONPATH=src alembic upgrade head
APP_ENV=local PYTHONPATH=src python -m scripts.setup_langgraph_checkpointer
APP_ENV=local PYTHONPATH=src python -m scripts.seed_db
```

Start the API:

```bash
APP_ENV=local PYTHONPATH=src uvicorn api.app:app --host 0.0.0.0 --port 8000
```

On Windows/PowerShell, set `PYTHONPATH` so `api.app` can resolve imports under
`src`:

```powershell
$env:PYTHONPATH="src"
$env:APP_ENV="local"
python -m alembic upgrade head
python -m scripts.setup_langgraph_checkpointer
python -m scripts.seed_db
uvicorn api.app:app --host 0.0.0.0 --port 8000
```

### Frontend

Enter the frontend folder:

```bash
cd src/frontend
```

Install dependencies:

```bash
npm install
```

Start Next.js:

```bash
npm run dev
```

By default, the frontend proxy points to:

```text
http://127.0.0.1:8000
```

To change it:

```bash
API_BASE_URL=http://localhost:8000 npm run dev
```

## Agent Development

Prompts are separated by responsibility in `src/prompts/`:

- `orchestator_planner`
- `outfit_request_extractor`
- `outfit_maker/orchestation`
- `business_qa`
- `final_response_writer`

The `INCLUDE_PROMPT_EXAMPLES` flag allows examples to be included or excluded
for some prompts. This is useful when experimenting with extractor and
orchestrator accuracy without changing code.

## Error Handling

Graph nodes use `safe_node`, defined in `src/utils/error_handling.py`. When an
exception occurs, the error is added to the state as `workflow_errors`, and the
user receives a generic recovery message.

This allows workflow errors to be persisted alongside the assistant message and
makes debugging easier from the database or API response.

## Authentication

Authentication is implemented without an external provider:

- Password hashing with `hashlib.scrypt`.
- Bearer token signed with HMAC SHA-256 and bounded by issued-at/expiration timestamps.
- Configurable expiration.
- Session persisted in the frontend's `localStorage` until the token expires.

For production, `AUTH_TOKEN_SECRET` must be changed. A more robust token/auth
system should be evaluated if the product scope grows.

## Useful Commands

Run the full stack after its initial migration and checkpointer setup:

```bash
docker compose up --build
```

Run only the local backend:

```bash
PYTHONPATH=src uvicorn api.app:app --host 0.0.0.0 --port 8000
```

On Windows/PowerShell:

```powershell
$env:PYTHONPATH="src"
uvicorn api.app:app --host 0.0.0.0 --port 8000
```

Run backend tests:

```bash
PYTHONPATH=src python -m pytest tests/
```

Run the frontend:

```bash
cd src/frontend
npm run dev
```

Lint the frontend:

```bash
cd src/frontend
npm run lint
```

Build the frontend:

```bash
cd src/frontend
npm run build
```

## License

MIT

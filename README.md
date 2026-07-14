# Multimodal Clothing Assistance System

An in-progress platform for intelligent fashion-store assistance. The project
combines a conversational agent, product search over a clothing catalog, store
information Q&A, and outfit/product recommendations based on natural-language
user requests.

> Status: under active development. The conversational backend,
> authentication, conversation persistence, business-information RAG, and
> text-based product search are already implemented. User image uploads, full
> visual reasoning, and persistent saved outfits as first-class entities are
> part of the product vision and are still being built.

## Project Vision

The goal is to provide an AI-assisted shopping experience for users who do not
want to browse traditional category filters. Instead of manually selecting
facets, users can describe what they need:

- "I need an outfit for a wedding, with a red dress and formal accessories."
- "I am looking for grey men's sports shoes, preferably from FILA."
- "What payment methods do you accept?"
- "I want a tennis outfit with sneakers, a T-shirt, and shorts."

The assistant interprets the user's intent, decides which capabilities are
needed, retrieves store information when relevant, searches the catalog, and
returns a structured answer with recommendations ready to be rendered in the
frontend.

The multimodal vision includes letting users upload reference images or similar
products to improve search and recommendations. In the current state, the
request extraction schema already includes image fields, product records include
multiple image references, and the frontend renders recommended product images,
but the API and UI are still primarily text-based.

## Implemented Features

- Authenticated chat with registration, login, and browser-persisted sessions.
- Per-user conversation history.
- Conversation creation, retrieval, and deletion.
- Persistent user and assistant messages.
- Assistant responses with structured payloads for the frontend.
- Visual recommendation panel for products and outfits.
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
- Next.js frontend with chat, sidebar, conversation history, login, register,
  and UI preferences.

## In Development / Roadmap

- User image uploads for true multimodal search.
- Visual comparison against similar catalog products.
- Saving personalized outfits as dedicated database entities.
- Editing previously saved outfits.
- Favorites, collections, or wishlist flows.
- Dedicated "Create your style" frontend flow.
- Dedicated endpoints for outfit management.
- Improved stock/availability and real pricing logic.
- Automated backend and frontend tests.
- Versioned database migrations.

## Architecture Overview

The system is organized into three main layers:

```text
User
  |
  v
Next.js Frontend
  |
  v
FastAPI API
  |
  v
LangGraph Supervisor Agent
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

1. Initializes the database through `Database`.
2. Runs `seed_catalog()` to load the catalog when it is still empty.
3. Starts the LangGraph checkpointer.
4. Builds the `ConversationRuntimeService`.
5. Disposes database/checkpointer resources on shutdown.

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
- `POST /api/users/me/conversations`
- `GET /api/users/me/conversations`
- `DELETE /api/users/me/conversations`

Conversations:

- `GET /api/conversations/{conversation_id}`
- `GET /api/conversations/{conversation_id}/messages`
- `POST /api/conversations/{conversation_id}/messages`
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
- Redirects based on session state.
- Authenticated workspace.
- Sidebar with conversation history.
- Main chat workspace.
- Recommendation panel.
- Outfit modal on smaller screens.
- Interface preferences.

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
DATABASE_URL=sqlite:///catalog.db
LANGGRAPH_CHECKPOINT_DATABASE_URL=sqlite:///data/langgraph_checkpoints.sqlite

AUTH_TOKEN_SECRET=change-this-secret
AUTH_TOKEN_EXPIRE_MINUTES=60
IMAGE_ANALYSIS_MODEL=gemini-2.5-flash

LLM_SUB_AGENTS_PROVIDER=google
LLM_SUPERVISOR_PROVIDER=google
EMBEDDINGS_PROVIDER=google

GOOGLE_LLM_MODEL=gemini-2.0-flash
GOOGLE_EMBEDDING_MODEL=gemini-embedding-001
GOOGLE_API_KEY=your-google-api-key

GROQ_LLM_MODEL=llama-3.3-70b-versatile
GROQ_API_KEY=your-groq-api-key

INCLUDE_PROMPT_EXAMPLES=false
PRODUCT_SEARCH_PRIORITY_FIELDS=
```

Relevant variables:

- `DATABASE_URL`: main SQLAlchemy database connection.
- `DATABASE_ECHO`: enables SQL logs.
- `LANGGRAPH_CHECKPOINT_DATABASE_URL`: database for LangGraph checkpoints.
- `AUTH_TOKEN_SECRET`: HMAC secret for bearer tokens.
- `AUTH_TOKEN_EXPIRE_MINUTES`: token duration in minutes.
- `IMAGE_ANALYSIS_MODEL`: Google Gemini model used to describe uploaded images for visual product search.
- `GOOGLE_LLM_MODEL`: Google chat model.
- `GROQ_LLM_MODEL`: Groq chat model.
- `GOOGLE_EMBEDDING_MODEL`: embedding model.
- `LLM_SUB_AGENTS_PROVIDER`: provider for sub-agents.
- `LLM_SUPERVISOR_PROVIDER`: provider for the supervisor.
- `EMBEDDINGS_PROVIDER`: provider for embeddings.
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

The easiest way to run the full stack is:

```bash
docker compose up --build
```

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

Start the API:

```bash
uvicorn api.app:app --host 0.0.0.0 --port 8000
```

On Windows/PowerShell, when running outside the container, you may need to set
`PYTHONPATH` so `api.app` can resolve imports under `src`:

```powershell
$env:PYTHONPATH="src"
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

Run the full stack:

```bash
docker compose up --build
```

Run only the local backend:

```bash
uvicorn api.app:app --host 0.0.0.0 --port 8000
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

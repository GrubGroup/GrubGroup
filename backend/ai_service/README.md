# GrubGroup — AI / Data Service (FastAPI)

Python backend dedicated to API logic, agent orchestration, and the AI pipeline.

## Responsibilities

- **SQLModel ORM** — read-side mirror of the Prisma-owned schema over PostgreSQL + pgvector (data layer)
- **LangGraph / LangChain** multi-agent pipeline (per-user preference agent + group orchestrator agent)
- **RAG** — Qwen embeddings via OpenRouter + pgvector retrieval over restaurants/menus
- **LLM chat calls** via the Salesforce internal model gateway → Claude (active; OpenRouter/DeepSeek commented in `ai/llm/client.py` for deploy) for ranking, reasoning, and preference extraction
- **Voice relay** — Whisper / Gemini STT and ElevenLabs TTS (transcribed text feeds the same pipeline as typed text)

The Node.js **gateway** service proxies AI/RAG requests to this service.

## Stack

FastAPI · SQLModel · asyncpg · pgvector · LangChain · LangGraph · OpenAI/OpenRouter · pydantic-settings. Managed with [`uv`](https://docs.astral.sh/uv/), Python 3.14.

## Project layout

```
app/
  main.py        # FastAPI app factory
  core/          # config, security (end-user JWT verify — stub), logging, exceptions
  db/            # async engine/session, metadata base, init_db (stub — Prisma owns DDL)
  models/        # SQLModel tables
  schemas/       # Pydantic request/response DTOs
  api/v1/        # versioned routers (health, ai, voice, public, members, restaurants, admin)
  services/      # business logic
  crud/          # async data access (incl. pgvector similarity)
  ai/            # llm / rag / agents / graph / voice subsystem
scripts/         # seed_restaurants, reset_db
```

## Getting started

```bash
uv sync                       # create .venv and install dependencies
cp .env.example .env          # fill in DATABASE_URL and API keys
uv run uvicorn app.main:app --reload
```

Seed mock data:

```bash
uv run python -m scripts.seed_restaurants
```

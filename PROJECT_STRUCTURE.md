# GrubGroup — Project File Structure

This document explains how the GrubGroup repository is organized.

---

## 1. Overview (for everyone)

GrubGroup is a voice-first, group restaurant-recommendation web app. The repository is a
**monorepo** with three top-level areas:

| Area                         | What it is                                           | Who owns it  |
| ---------------------------- | ---------------------------------------------------- | ------------ |
| `frontend/`                  | The React web app users interact with in the browser | Frontend     |
| `backend/`                   | The server side, split into two cooperating services | Backend / AI |
| `planning/` & `reflections/` | Project docs, proposals, and weekly team reflections | Whole team   |

The backend is itself split into **two services**:

- **`backend/gateway/`** — Node.js + Express + Socket.IO. The frontend talks to this. It
  handles real-time updates, login/auth (JWT), and forwards AI requests to the AI service.
- **`backend/ai_service/`** — Python + FastAPI. The "brains": AI agents, restaurant
  search (RAG), the database, and voice processing.

### How the pieces talk to each other

```
   Browser                Node service               Python service            Database
┌────────────┐   REST /   ┌──────────────┐   HTTP    ┌───────────────┐        ┌──────────┐
│  frontend  │◀─socket.io▶│   gateway    │◀─────────▶│   ai_service  │◀──────▶│ Postgres │
│  (React)   │            │ (Express +   │           │  (FastAPI +   │        │ +pgvector│
│            │            │  Socket.IO)  │           │  LangGraph)   │        │          │
└────────────┘            └──────────────┘           └───────────────┘        └──────────┘
```

---

## 2. Root folder

```
GrubGroup/
├── README.md              # Project overview
├── PROJECT_STRUCTURE.md   # This file — explains the folder layout
├── frontend/              # React + TypeScript + Vite web app  (see §4)
├── backend/               # Unified backend: gateway + ai_service  (see §3)
├── planning/              # Product & system design documents
│   ├── project_plan.md
│   ├── project_proposal.md
│   ├── user_stories.md
│   ├── design_ui.md
│   └── README.md
└── reflections/           # Weekly team reflections
    ├── reflection1.md … reflection5.md
    └── README.md
```

---

## 3. Backend root (`backend/`)

The backend is one folder containing **two separate services** that run as separate
processes.

```
backend/
├── README.md          # How the two services fit together
├── gateway/           # Node.js + Express + Socket.IO  (managed with Bun)
└── ai_service/        # Python + FastAPI               (managed with uv)
```

### 3a. `backend/gateway/` — Real-Time Service (Node.js + Express)

The **frontend-facing** service. Responsibilities: WebSocket live sync (cart & session
state), JWT authentication, and proxying AI/RAG requests to `ai_service`.

```
gateway/
├── package.json                  # Dependencies (Express, Socket.IO, JWT, axios) + Bun scripts
├── .env.example                  # Sample environment variables
├── .gitignore
├── server.js                     # Entry point: starts the HTTP + WebSocket server
└── src/
    ├── app.js                    # Express app setup (middleware + route mounting)
    ├── config/
    │   └── index.js              # Loads & validates environment config
    ├── routes/                   # URL → controller mappings
    │   ├── index.js              # Combines all routes
    │   ├── auth.routes.js        # /auth   — register / login
    │   ├── ai.routes.js          # /ai     — forward to Python service
    │   └── sessions.routes.js    # /sessions — group session & cart
    ├── controllers/              # Request handlers (the logic per route)
    │   ├── auth.controller.js
    │   ├── ai.controller.js
    │   └── sessions.controller.js
    ├── middleware/               # Cross-cutting request logic
    │   ├── auth.middleware.js    # Checks the JWT on protected routes
    │   └── error.middleware.js   # Central error handling
    ├── sockets/                  # Real-time WebSocket logic
    │   ├── index.js              # Socket.IO setup + auth handshake
    │   └── session.handlers.js   # join/leave, cart sync, preference broadcast
    ├── services/                 # Reusable helpers
    │   ├── aiClient.js           # Talks to the FastAPI ai_service
    │   └── jwt.service.js        # Creates & verifies tokens
    └── utils/
        └── logger.js             # Logging helper
```

### 3b. `backend/ai_service/` — AI / Data Service (FastAPI)

The Python "brains." Responsibilities: the database, AI agents, restaurant search, and
voice processing.

```
ai_service/
├── pyproject.toml / uv.lock / .python-version   # Python project + locked dependencies
├── .env.example / .gitignore / .dockerignore
├── Dockerfile                    # How to package this service for deployment
├── README.md                     # Service-specific setup instructions
├── main.py                       # Small shim → runs app/main.py
├── scripts/                      # One-off dev/ops scripts
│   ├── seed_restaurants.py       # Fills the DB with 50+ mock restaurants
│   └── reset_db.py               # Resets the database for local development
└── app/                          # The actual application code
    ├── main.py                   # Builds & configures the FastAPI app
    ├── core/                     # App-wide infrastructure
    │   ├── config.py             # Reads settings from environment
    │   ├── security.py           # End-user JWT verify (stub); internal hop uses X-Internal-Secret
    │   ├── logging.py
    │   └── exceptions.py
    ├── db/                       # Database connection & setup
    │   ├── session.py            # Async database engine/session
    │   ├── base.py               # Registers all tables (metadata mirror of Prisma)
    │   └── init_db.py            # Stub — Prisma (gateway) owns DDL + pgvector, not create_all
    ├── models/                   # Database tables (SQLModel)
    │   ├── user.py  profile.py  session.py  session_member.py
    │   ├── message.py  restaurant.py  menu_item.py
    │   └── enums.py              # Shared value lists (roles, statuses, …)
    ├── schemas/                  # Request/response shapes (Pydantic)
    │   ├── user.py  profile.py  session.py  restaurant.py  menu_item.py
    │   ├── ai.py                 # AI request/response shapes (no DB table)
    │   ├── voice.py
    │   └── common.py
    ├── api/                      # The HTTP endpoints
    │   ├── deps.py               # Shared dependencies (current user, DB session)
    │   └── v1/                   # Version 1 of the API (mounted at /api/v1)
    │       ├── router.py         # Combines all v1 routes
    │       └── routes/
    │           ├── health.py         # Is the service up?
    │           ├── ai.py             # AI analyze + recommendations
    │           ├── voice.py          # Speech-to-text / text-to-speech
    │           ├── public.py         # Public restaurant browsing (no login)
    │           ├── members.py        # Logged-in members: sessions, cart, profile
    │           ├── restaurants.py    # Restaurant owners: menu, dashboard
    │           └── admin.py          # Admins: moderation, roles, audit
    ├── services/                 # Business logic (multi-step workflows)
    │   ├── session_service.py  profile_service.py
    │   ├── recommendation_service.py  message_service.py
    │   └── restaurant_service.py
    ├── crud/                     # Direct database read/write helpers
    │   ├── base.py  user.py  session.py  message.py
    │   └── restaurant.py         # Includes pgvector similarity search
    └── ai/                       # The AI subsystem
        ├── llm/                  # Talking to language models
        │   ├── client.py         # Salesforce gateway → Claude (active; OpenRouter/DeepSeek commented)
        │   └── prompts.py        # Prompt templates
        ├── rag/                  # Restaurant search by meaning ("RAG")
        │   ├── embeddings.py     # Turns text into vectors (Qwen)
        │   └── retriever.py      # Finds similar restaurants via pgvector
        ├── agents/               # The AI "personas"
        │   ├── preference_agent.py    # Learns one person's preferences
        │   └── orchestrator_agent.py  # Reconciles the whole group
        ├── graph/                # Multi-step AI pipeline (LangGraph)
        │   ├── pipeline.py       # Wires the steps together
        │   └── state.py          # Data passed between steps
        └── voice/                # Voice input/output
            ├── stt.py            # Speech → text (Whisper / Gemini)
            └── tts.py            # Text → speech (ElevenLabs)
```

---

## 4. Frontend root (`frontend/`)

React + TypeScript app built with **Vite**, styled with **TailwindCSS**, managed with
**Bun**.

> **Status:** The frontend is currently the initial Vite starter (below). Feature folders
> (pages, components, state, API client) will be added as the UI is built out.

```
frontend/
├── package.json          # Dependencies (React, Router, axios, socket.io-client, zustand, …)
├── bun.lock              # Locked dependency versions
├── vite.config.ts        # Vite build/dev configuration
├── tsconfig*.json        # TypeScript configuration
├── eslint.config.js      # Linting rules
├── index.html            # HTML entry point
├── README.md
├── public/               # Static files served as-is
│   ├── favicon.svg
│   └── icons.svg
└── src/                  # Application source
    ├── main.tsx          # App entry point (mounts React)
    ├── App.tsx           # Root component
    ├── index.css         # Global styles (Tailwind)
    ├── App.css
    └── assets/           # Images used in components
        ├── hero.png  react.svg  vite.svg
```

### 4a. Planned `src/` layout (not yet created)

As features are built, `src/` is expected to grow into the structure below. It mirrors the
role-based areas of the backend (public / member / owner / admin) and maps directly to the
installed libraries.

```
src/
├── api/            # HTTP calls to the gateway (uses axios)
├── routes/         # App routing setup (react-router-dom)
├── pages/          # Full screens, grouped by user role
│   ├── public/         # Landing page, restaurant discovery
│   ├── auth/           # Login / signup
│   ├── member/         # Group session, cart, profile, history
│   ├── owner/          # Restaurant dashboard, menu editor
│   └── admin/          # Moderation, audit, roles
├── components/     # Reusable UI pieces
│   ├── ui/             # Buttons, inputs, cards (design system)
│   ├── layout/         # Headers, nav, page shells
│   ├── session/        # Group session room widgets
│   ├── voice/          # Voice input UI (react-speech-recognition)
│   ├── restaurant/     # Restaurant/menu cards
│   └── cart/           # Shared group cart
├── hooks/          # Reusable React logic (useAuth, useSocket, useVoiceInput)
├── stores/         # Client state (zustand)
├── lib/            # Third-party client setup (socket.io-client, jwt-decode, axios instance)
├── types/          # Shared TypeScript types
├── utils/          # Small helper functions
└── constants/      # App-wide constants
```

---

## 5. Quick reference — "Where do I put…?"

| I want to add…                | It goes in…                                    |
| ----------------------------- | ---------------------------------------------- |
| A new API endpoint (Python)   | `backend/ai_service/app/api/v1/routes/`        |
| A new database table          | `backend/ai_service/app/models/`               |
| AI agent / prompt logic       | `backend/ai_service/app/ai/`                   |
| A real-time (WebSocket) event | `backend/gateway/src/sockets/`                 |
| A login / proxy route (Node)  | `backend/gateway/src/routes/` + `controllers/` |
| A new screen/page (React)     | `frontend/src/pages/`                          |
| A reusable UI element (React) | `frontend/src/components/`                     |
| A product/planning doc        | `planning/`                                    |

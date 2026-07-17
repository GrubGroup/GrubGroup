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
  handles real-time updates, auth (Better Auth cookie sessions), and forwards AI requests to the
  AI service.
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

The **frontend-facing** service. Responsibilities: Better Auth (cookie sessions), Socket.IO
live chat/session sync, Prisma writes for frontend data, and proxying AI/RAG requests to
`ai_service`. Auth is **Better Auth**, mounted at `/api/auth/*` directly in `app.js` — there is
no `auth.routes.js` / `auth.controller.js` / `jwt.service.js`.

```
gateway/
├── package.json                  # Deps (Express, Socket.IO, better-auth, @prisma/client, axios) + Bun scripts
├── .env.example                  # Sample environment variables
├── .gitignore
├── server.js                     # Entry point: starts the HTTP + WebSocket server
└── src/
    ├── app.js                    # Express app: mounts Better Auth /api/auth/* (before express.json), /api/me, routes
    ├── lib/
    │   ├── auth.js               # Better Auth config (Prisma adapter, email/password + Google)
    │   └── prisma.js             # Prisma client singleton
    ├── config/
    │   └── index.js              # Loads & validates environment config
    ├── routes/                   # URL → controller mappings
    │   ├── index.js              # Combines routes; mounts /health, /restaurants, /sessions
    │   ├── restaurants.routes.js # /restaurants — create + embed (WIRED)
    │   ├── sessions.routes.js    # /sessions — POST /:id/recommendations proxy (WIRED)
    │   └── ai.routes.js          # /ai — one-line starter, NOT mounted (proxy lives in sessions + aiClient)
    ├── controllers/              # Request handlers (the logic per route)
    │   ├── restaurants.controller.js  # create Restaurant + embed via ai_service + ::vector write (WIRED)
    │   ├── sessions.controller.js     # proxy to ai_service w/ status passthrough (WIRED)
    │   └── ai.controller.js           # one-line starter (NOT wired)
    ├── middleware/               # Cross-cutting request logic
    │   ├── auth.middleware.js    # Better Auth session guard (requireAuth / requireRole)
    │   └── error.middleware.js   # Central error handling
    ├── sockets/                  # Real-time WebSocket logic
    │   ├── index.js              # Socket.IO setup + session-cookie handshake
    │   └── session.handlers.js   # group:join/leave, chat:message, session:start, typing:* (ephemeral)
    ├── services/                 # Reusable helpers
    │   └── aiClient.js           # Talks to the FastAPI ai_service (embed + getRecommendations)
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
│   ├── seed_restaurants.py       # Fills the DB with ~54 mock restaurants (with embeddings)
│   ├── reset_db.py               # Resets the database for local development
│   ├── smoke_orchestrator.py     # Direct end-to-end orchestrator graph smoke test
│   └── live_http_gateway_e2e.py  # Live HTTP harness across ai_service + gateway (401/409/200)
└── app/                          # The actual application code
    ├── main.py                   # Builds & configures the FastAPI app (WIRED)
    ├── core/                     # App-wide infrastructure
    │   ├── config.py             # Reads settings from environment (WIRED)
    │   ├── security.py           # End-user token verify — one-line starter; internal hop uses X-Internal-Secret
    │   ├── logging.py            # one-line starter
    │   └── exceptions.py         # one-line starter
    ├── db/                       # Database connection & setup
    │   ├── session.py            # Async database engine/session (WIRED)
    │   ├── base.py               # Registers all tables (metadata mirror of Prisma)
    │   └── init_db.py            # Starter, unused — Prisma (gateway) owns DDL + pgvector; ai_service never runs create_all
    ├── models/                   # Database tables (SQLModel read-side mirror)
    │   ├── user.py  profile.py  session.py  session_member.py     # WIRED
    │   ├── restaurant.py  qa.py  group.py                         # WIRED (restaurant has vector(1024) embedding)
    │   ├── recommendation.py  recommendation_item.py              # WIRED
    │   ├── timestamps.py  enums.py                                # WIRED (utcnow helper; Role/MessageType)
    │   └── message.py  menu_item.py                               # one-line starters (no table yet)
    ├── schemas/                  # Request/response shapes (Pydantic)
    │   ├── ai.py                 # AI request/response DTOs (WIRED: Embed*, Recommendation*)
    │   └── user.py  profile.py  session.py  restaurant.py  voice.py  common.py   # starters
    ├── api/                      # The HTTP endpoints
    │   ├── deps.py               # Shared deps: get_db_session, require_internal_secret (WIRED)
    │   └── v1/                   # Version 1 of the API (mounted at /api/v1)
    │       ├── router.py         # Combines v1 routes — mounts only health + ai today
    │       └── routes/
    │           ├── health.py         # Is the service up? (WIRED)
    │           ├── ai.py             # POST /embed, POST /sessions/{id}/recommendations (WIRED)
    │           ├── voice.py          # STT / TTS — starter, not mounted
    │           ├── public.py         # Public browsing — starter, not mounted
    │           ├── members.py        # Member endpoints — starter, not mounted
    │           ├── restaurants.py    # Owner endpoints — starter, not mounted
    │           └── admin.py          # Admin endpoints — starter, not mounted
    ├── services/                 # Business logic (multi-step workflows)
    │   ├── recommendation_service.py  # WIRED (orchestrator wrapper: guard → pipeline → persist)
    │   └── session_service.py  profile_service.py  message_service.py  restaurant_service.py  # starters
    ├── crud/                     # Direct database read/write helpers
    │   ├── base.py               # Generic async CRUDBase (WIRED)
    │   ├── session.py            # Reads: members, profiles, Qa, all_confirmed (WIRED)
    │   ├── restaurant.py         # Reads + pgvector similarity search (WIRED)
    │   ├── recommendation.py     # WRITES Recommendation + RecommendationItem (WIRED)
    │   └── user.py  message.py   # one-line starters
    └── ai/                       # The AI subsystem (all WIRED except voice/)
        ├── llm/                  # Talking to language models
        │   ├── client.py         # Salesforce gateway → Claude (active; OpenRouter/DeepSeek commented)
        │   └── prompts.py        # Prompt templates (preference-normalize, group re-rank)
        ├── rag/                  # Restaurant search by meaning ("RAG")
        │   ├── embeddings.py     # Turns text into vectors (Qwen3 via OpenRouter, 1024-dim)
        │   └── retriever.py      # pgvector cosine search + hard filters (dietary/price/geo)
        ├── agents/               # The AI "personas"
        │   ├── preference_agent.py    # Normalizes one member's Profile → MemberPref
        │   └── orchestrator_agent.py  # Reconciles the group: retrieve → LLM re-rank → fallback
        ├── graph/                # Multi-step AI pipeline (LangGraph)
        │   ├── pipeline.py       # StateGraph: fan-out preference → orchestrator
        │   └── state.py          # Typed state passed between steps
        └── voice/                # Voice input/output — one-line starters
            ├── stt.py            # Speech → text (Whisper / Gemini)
            └── tts.py            # Text → speech (ElevenLabs)
```

---

## 4. Frontend root (`frontend/`)

React + TypeScript app built with **Vite**, styled with **TailwindCSS**, managed with
**Bun**.

> **Status:** The frontend is a **full build-out** (not a Vite starter). It uses Better Auth
> for auth and a zustand **screen-based navigation** store — there is **no `react-router-dom`**.
> Styling is TailwindCSS v4, wired via `@tailwindcss/vite` + `@import "tailwindcss"` (`@theme`
> tokens in `index.css`; no `tailwind.config.js`).

```
frontend/
├── package.json          # Deps (React 19, axios, socket.io-client, zustand, better-auth, tailwindcss v4, …)
├── bun.lock              # Locked dependency versions
├── vite.config.ts        # Vite config — registers react() + @tailwindcss/vite(); dev proxy to gateway
├── tsconfig*.json        # TypeScript configuration
├── eslint.config.js      # Linting rules
├── index.html            # HTML entry point
├── README.md
├── public/               # Static files served as-is (favicon.svg, icons.svg)
└── src/                  # Application source (see §4a)
    ├── main.tsx          # App entry point (mounts React)
    ├── App.tsx           # Root — session guard + navStore-driven screen switch (no router)
    ├── index.css         # Tailwind import + @theme design tokens
    └── assets/           # hero.png, react.svg, vite.svg
```

### 4a. `src/` layout (implemented)

The feature structure below **exists and is populated** — build new work into these folders.

```
src/
├── api/            # HTTP calls to the gateway via axios
│   ├── session.api.ts  events.api.ts  restaurants.api.ts  profile.api.ts   # live modules
│   └── mock/           # mock modules (session, restaurants, profile, groupChat, chatScript, groups, events)
├── pages/          # Full screens (navStore-driven; no react-router)
│   ├── auth/           # AuthPage (Better Auth sign-in/up + Google)
│   └── member/         # EmptyGroupsPage, GroupChatPage, EventsPage
│       ├── onboarding/     # Onboarding1-3
│       └── session/        # AgentChatPage, TopPicksPage
├── components/     # reusable UI pieces
│   ├── ui/             # Design-system primitives (Button, Input, Card, Modal, …) + index.ts
│   ├── layout/         # AppSidebar, BrandPanel, OnboardingLayout
│   ├── session/        # Session/chat widgets (HostSessionModal, SessionTopBar, SessionTimer, SessionPicksBlock, SessionCard, ChatStream, …)
│   ├── restaurant/     # Restaurant/menu cards (RankedRestaurantCard — reused for TopPicks + in-chat picks, MenuList, VoteControl, …)
│   ├── profile/        # Profile fields (Dietary, Cuisine, Budget, Location, LikedRestaurants)
│   ├── event/          # Shared group event (EventDrawer, EventItemRow, EventSummary)
│   └── voice/          # VoiceComposer (react-speech-recognition)
├── hooks/          # useSocket, useSessionCountdown, useVoiceInput, usePlacesInput
├── stores/         # 10 zustand stores: auth, session, groupChat, chat, event, eventList, profile, groups, restaurant, nav
├── lib/            # Client setup: axios, socket, authClient (Better Auth), env
├── types/          # Shared TypeScript types (user, profile, session, recommendation, analyze, group, restaurant, …)
├── utils/          # Small helpers (cn.ts, hours.ts — TS mirror of ai_service app/ai/hours.py)
└── constants/      # App-wide constants (dietary.ts)
```

---

## 5. Quick reference — "Where do I put…?"

| I want to add…                | It goes in…                                    |
| ----------------------------- | ---------------------------------------------- |
| A new API endpoint (Python)   | `backend/ai_service/app/api/v1/routes/`        |
| A new database table          | `backend/ai_service/app/models/`               |
| AI agent / prompt logic       | `backend/ai_service/app/ai/`                   |
| A real-time (WebSocket) event | `backend/gateway/src/sockets/`                 |
| Auth (sign-in/up, OAuth)      | `backend/gateway/src/lib/auth.js` (Better Auth; mounted in `app.js`) |
| An AI-proxy route (Node)      | `backend/gateway/src/routes/` + `controllers/` + `services/aiClient.js` |
| A new screen/page (React)     | `frontend/src/pages/`                          |
| A reusable UI element (React) | `frontend/src/components/`                     |
| A product/planning doc        | `planning/`                                    |

# GrubGroup — Frontend

The browser app for GrubGroup: a React 19 single-page application with screen-based navigation, styled with TailwindCSS v4, managed with Bun. Users authenticate via Better Auth (cookie sessions), join group chats, talk (voice or text) to their AI preference agent during a session, and view the shared restaurant picks the host confirms into a group Event.

This frontend talks exclusively to the **gateway** service (REST + Socket.IO) and never calls `ai_service` directly.

## Stack

| Library                    | Purpose                                                      |
| -------------------------- | ------------------------------------------------------------ |
| React 19                   | Component-based UI                                            |
| TypeScript                 | Type-safe codebase                                            |
| Vite 8                     | Dev server + build tool                                       |
| TailwindCSS 4              | Utility-first styling via `@tailwindcss/vite` plugin (v4 config-less: tokens in `@theme` blocks in CSS, no `tailwind.config.js`) |
| zustand                    | Client-side state stores and screen navigation (`navStore`)  |
| better-auth                | Auth client (`useSession`, `signIn`/`signUp`/`signOut`), email/password + Google OAuth |
| axios                      | HTTP calls to the gateway (`withCredentials: true` for cookie sessions) |
| socket.io-client           | Live group chat and session sync via the gateway             |
| react-speech-recognition   | Browser speech-to-text (voice input UI)                      |
| use-places-autocomplete    | Location entry / autocomplete                                |
| framer-motion              | Animation and transitions                                    |

Managed with **Bun** (ESM: `"type": "module"`).

## Commands

```bash
bun install      # Install dependencies
bun run dev      # Vite dev server on port 5173
bun run build    # tsc -b && vite build
bun run lint     # eslint .
bun run preview  # Preview the production build
```

## Key conventions

- **Screen-based navigation** — No `react-router-dom`. Navigation is a state machine in `stores/navStore.ts` (a `screen` value + transitions), rendered via a switch in `App.tsx`.
- **PascalCase `*.tsx`** for components; **camelCase `*.ts`** for hooks, stores, utils, api modules.
- **Strict TypeScript** — `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`. Keep imports type-only where required (`import type { … }`).
- **Live-gateway only** — There is no mock layer (the old `VITE_USE_MOCK` switch and `api/mock/` were removed). The app always runs against the live gateway. Auth is mandatory: `App.tsx` guards non-auth screens on the Better Auth session.
- **Gateway origin** — `VITE_GATEWAY_URL` (default `http://localhost:4000`) points at the gateway. The Vite dev server proxy forwards `/api` requests to the gateway; `CORS_ORIGIN` in the gateway's `.env` must match the Vite dev origin (`:5173`).
- **Auth flow** — `lib/authClient.ts` points at the gateway. `signIn`/`signUp`/Google OAuth hit the gateway's `/api/auth/*`, which sets an httpOnly session cookie (first-party via the Vite dev proxy). The app reads the session with `useSession()` and mirrors it into `authStore`; axios uses `withCredentials: true` so the cookie rides along on every request. No client-side JWT.

## Running

The frontend must run alongside the **gateway** (port 4000) and **ai_service** (port 8000), plus PostgreSQL. See the root [README.md](../README.md) for full setup.

```bash
cd frontend
bun install
bun run dev
```

Visit [http://localhost:5173](http://localhost:5173).

## Project layout

```
src/
├── main.tsx          # App entry point (mounts React)
├── App.tsx           # Root — session guard + navStore-driven screen switch (no router)
├── index.css         # Tailwind import + @theme design tokens
├── api/              # HTTP calls to the gateway via axios
│   ├── sessionApi.ts  eventsApi.ts  restaurantsApi.ts  profileApi.ts
│   ├── authApi.ts  groupsApi.ts  userApi.ts  usersApi.ts
│   └── (no mock layer)
├── pages/            # Full screens (navStore-driven)
│   ├── auth/         # AuthPage (Better Auth sign-in/up + Google)
│   └── member/       # EmptyGroupsPage, GroupChatPage, EventsPage, ProfilePage, ProfileEditPage
│       ├── onboarding/     # Onboarding1-3 + OnboardingCuisines
│       └── session/        # AgentChatPage, TopPicksPage
├── components/       # Reusable UI pieces
│   ├── ui/           # Design-system primitives (Button, Input, Card, Modal, …) + index.ts
│   ├── layout/       # AppSidebar, BrandPanel, OnboardingLayout
│   ├── session/      # HostSessionModal, SessionTopBar, SessionTimer, SessionPicksBlock, SessionCard, ChatStream, …
│   ├── restaurant/   # RankedRestaurantCard, MenuList, VoteControl, …
│   ├── profile/      # CuisineTriStatePicker, PreferenceTag, Dietary, Cuisine, Budget, Location, LikedRestaurants
│   ├── event/        # EventDrawer, EventItemRow, EventSummary
│   └── voice/        # VoiceComposer (react-speech-recognition)
├── hooks/            # useSocket, useSessionCountdown, useVoiceInput, usePlacesInput, useMediaQuery, useNewItemIds, useScrollToBottom
├── stores/           # 10 zustand stores: auth, session, groupChat, chat, event, eventList, profile, groups, restaurant, nav
├── lib/              # axios, socket, authClient (Better Auth), env, motion
├── types/            # Shared TypeScript types (user, profile, session, recommendation, analyze, group, restaurant, …)
├── utils/            # cn.ts, hours.ts (TS mirror of ai_service app/ai/hours.py)
└── constants/        # dietary.ts, memberColors.ts, agentChat.ts
```

See [../PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md) §4 for the full folder tree and working rules in [CLAUDE.md](CLAUDE.md).

## Documentation

- [CLAUDE.md](CLAUDE.md) — frontend working rules: stack, commands, conventions, status
- [../PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md) — full folder tree
- [../CLAUDE.md](../CLAUDE.md) — project memory bank (cross-service contracts, architecture rules)
- [../backend/CLAUDE.md](../backend/CLAUDE.md) — backend working rules

---

This is a **full build-out**, not a Vite starter. Build new features into the existing layout.

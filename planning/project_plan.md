# Project Plan

**Team:** GrubGroup
**Pod Members:** Daniel Lam, Della Lee, Audrey Dequito, Miguel Cuevas

## Project Links

| Resource              | Link                                                                                                                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Notion task board** | [Notion Board](https://app.notion.com/p/Product-Planning-Document-38e50fd4485a80cd8a42de168d3d6706?source=copy_link)                                                                                                                     |
| Figma wireframes      | [GrubGroup Wireframes](https://www.figma.com/proto/mEDkotB3eUYXYc1E6arQ7t/GrubGroup-Wireframes--Separated-?node-id=8-2258&p=f&t=hpotyvnyr1hUF0H6-0&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1&starting-point-node-id=8%3A2258) |

## Problem Statement and Description

Problem Statement: Streamlining the process finding a restaurant between people (groups or 1:1) based on a questionnaire & constantly updated profiles.

A Group Based AI Food Planner:
A consumer-facing, "voice-first" web app where a group of friends each talk to their own AI agent about what they want to eat. A master AI orchestrator agent collects everyone's dietary preferences, budget, and location in real-time, finds restaurants that satisfy the whole group, lets each person browse and order from a shared menu, and connects everything into one group cart. This is all driven by a conversational, voice-enabled interface. Think Uber Eats but a group chat based on preference based on profile information

## User Roles and Personas

### Roles

| Role                             | Access                 | Description                                                                                                                                                                                                               |
| -------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Public**                       | No login               | Landing page + read-only restaurant discovery.                                                                                                                                                                            |
| **member**                       | Login (or guest)       | Joins/creates group sessions, sets a preference profile, chats with a personal AI agent, sees group recommendations, and shares a cart. Guest mode allowed for one-off sessions (no saved profile). **Primary MVP role.** |
| **admin**                        | Internal               | Approves restaurant listings, moderates content, and monitors the AI pipeline (audit logs, session traces).                                                                                                               |
| **restaurant_owner** _(stretch)_ | Login + admin approval | Manages a restaurant's listing, menu photos, descriptions, hours, and sees incoming group orders.                                                                                                                         |

Backed by the Prisma `Role` enum (`USER | OWNER | ADMIN`); "Public" is the unauthenticated state.

### Personas

**Member — Maya (26, grad student, SF):** the default planner in her friend group. Phone-first,
uses the app weekly with groups of 4–6 with mixed dietary needs (a vegan, a nut allergy). Wants
the planning burden gone without it feeling like a form.

**Member — Dev (31, software engineer, Austin):** never organizes; gets added to sessions. Has a
tree-nut allergy he's tired of re-entering — wants to set preferences **once**. Desktop by day,
phone by night, skeptical of voice in loud/open spaces. Uses the app 1–2×/month.

**Member — Sofia (42, marketing manager, Chicago):** organizes team lunches and client dinners
weekly for 10–15 people on a company budget. Desktop power user who needs **speed** (no slow
per-person AI chat) and cares about dietary variety, parking, and itemized receipts for expensing.

**Member — Tomás (22, college student, LA):** plans spontaneously (10:30pm "what's open?"). Phone-
only, wants **zero friction** — ideally no sign-up. Price is his first filter ($15–20/head), speed
second (answer in <2 min). Most likely to drop off if onboarding is slow or voice fails.

**Admin — Rachel (29, trust & content ops):** reviews new restaurant submissions, checks photos
aren't stock, flags stale listings. Non-technical, detail-oriented; needs a prioritized moderation
queue.

**Admin — James (35, technical super-admin):** monitors the AI pipeline, manages roles, debugs the
orchestrator. Needs audit logs and session traces to catch hallucinations or ignored hard dietary
constraints without digging through raw tables.

**Restaurant Owner _(stretch)_ — Anika (38, family South Indian restaurant, SF):** no tech staff;
comfortable with Instagram, not dashboards. Wants her mostly-vegan menu accurately labeled; uploads
photos from her phone.

**Restaurant Owner _(stretch)_ — Carlos (45, 3-location taqueria, DFW):** operations-focused. Needs
advance notice of large group orders and to manage all locations from one login.

## User Stories

Stories carry stable IDs (`M#`, `A#`, `O#`) so API contracts, wireframes, and GitHub issues can
reference them. **Sprint** column reflects current prioritization (see [Sprint Plan & Milestones](#sprint-plan--milestones)).

### Member (MVP core)

| ID  | Story                                                                                                                         | Sprint |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ------ |
| M1  | As a member, I want to set my dietary restrictions and food preferences **once**, so I don't repeat them every session.       | 1      |
| M2  | As a member, I want to update my profile at any time, so my preferences stay accurate.                                        | 1      |
| M3  | As a member, I want to create a group with my regular friends/coworkers, so I don't re-invite the same people.                | 1      |
| M4  | As a member, I want to chat with my group outside a session, so the app feels like a normal group chat.                       | 2      |
| M5  | As a member, I want to start a session from an existing group, so everyone's saved prefs are used automatically.              | 2      |
| M6  | As a member, I want to talk to my personal AI agent by voice or text, so I can share what I'm in the mood for without a form. | 2      |
| M7  | As a member, I want to see when other members have finished sharing prefs, so I know when we're ready.                        | 2      |
| M8  | As a member, I want a shortlist of restaurants that work for the whole group, so I don't check everyone's constraints myself. | 2      |
| M9  | As a member, I want to understand **why** a restaurant was recommended, so I can trust the suggestion.                        | 2      |
| M10 | As a member, I want to browse a restaurant's menu within the session, so I can decide what I'd order.                         | 3      |
| M11 | As a member, I want to add items to a shared group cart, so our whole order is in one place.                                  | 3      |
| M12 | As a member, I want the session to remember my location preference only **if** I gave one, so it doesn't ask when I haven't.  | 3      |
| M13 | As a member, I want to end a session once we've picked, so the result is saved and the chat returns to normal.                | 3      |
| M14 | As a member, I want a short summary of how a past session was decided, so I can recall the outcome.                           | 3      |
| M15 | As a member, I want to see the history of past sessions in a group, so I remember where we've eaten.                          | 3      |

### Admin

| ID  | Story                                                                                                         | Sprint |
| --- | ------------------------------------------------------------------------------------------------------------- | ------ |
| A1  | As an admin, I want to review new restaurant listings before they go live.                                    | 4      |
| A2  | As an admin, I want flagged photos/descriptions in a prioritized queue.                                       | 4      |
| A3  | As an admin, I want to approve or reject a restaurant submission.                                             | 4      |
| A4  | As an admin, I want logs of what the AI recommended and why, to catch ignored restrictions or hallucinations. | 4      |
| A5  | As an admin, I want to manage user roles and permissions.                                                     | 4      |

### Restaurant Owner _(stretch)_

| ID  | Story                                                                                     | Sprint  |
| --- | ----------------------------------------------------------------------------------------- | ------- |
| O1  | As an owner, I want to create a profile for my restaurant, so groups can discover it.     | Stretch |
| O2  | As an owner, I want to upload menu photos and edit descriptions/pricing.                  | Stretch |
| O3  | As an owner, I want to tag menu items with dietary labels, so I match groups I can serve. | Stretch |
| O4  | As an owner, I want to set hours, so I'm not recommended when closed.                     | Stretch |
| O5  | As an owner, I want to see incoming group orders before they arrive.                      | Stretch |

### Backlog (not actively built — revisit as priorities shift)

Special-occasion mode · budget-for-a-guest · post-meal ratings feeding long-term prefs · owner
match-insights · AI regression harness for admins · session time-limit nudges.

## Pages/Screens (Wireframes)

**Full wireframes (Figma, low-fidelity):** [GrubGroup Wireframes — Separated](https://www.figma.com/proto/mEDkotB3eUYXYc1E6arQ7t/GrubGroup-Wireframes--Separated-?node-id=8-2258&p=f&t=hpotyvnyr1hUF0H6-0&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1&starting-point-node-id=8%3A2258)

### Screen inventory

| Screen                       | Route/`navStore` screen | Role            | Serves stories   |
| ---------------------------- | ----------------------- | --------------- | ---------------- |
| Auth (sign-in / sign-up)     | `AuthPage`              | Public → member | prereq (M\*)     |
| Onboarding profile (3 steps) | `Onboarding1–3`         | member          | M1, M2           |
| Groups list / empty state    | `EmptyGroupsPage`       | member          | M3, M15          |
| Group chat room              | `GroupChatPage`         | member          | M4, M5, M7       |
| Agent chat (voice/text)      | `AgentChatPage`         | member          | M6, M9, M12      |
| Top picks (recommendations)  | `TopPicksPage`          | member          | M8, M9, M11, M13 |
| Events / history             | `EventsPage`            | member          | M14, M15         |

Below are text wireframes for the **three key screens**. Each wireframe is a visual component spec:
the indented boxes are the implied component hierarchy.

---

#### Wireframe 1 — Group Chat Room (`GroupChatPage`) — serves M4, M5, M7

What the user can do: read/send group chat messages in real time, see who's typing, and start a
food-finding session from a banner. Which stories: M4 (normal group chat), M5 (start session from
group), M7 (see readiness once a session starts).

```
┌──────────────────────────────────────────────────────────────┐
│ [AppSidebar]  │  GroupChatPage                                 │
│  • Groups     │ ┌────────────────────────────────────────────┐│
│  • Events     │ │ Header:  "Taco Tuesday Crew"   [Start 🍔]   ││   ← SessionInviteCard / start button
│  • Profile    │ ├────────────────────────────────────────────┤│
│  [GroupsSide- │ │ ChatStream                                  ││
│   bar]        │ │  ┌ GroupMessageRow (Sofia): "where to?"   ┐ ││   ← one per GroupMessage
│  + New group  │ │  └ GroupMessageRow (me): "somewhere vegan"┘ ││
│  (NewGroup-   │ │  [SessionCard]  ← inline when session:start ││   ← M5/M7: live session block
│   Modal)      │ │  [TypingIndicator]  "Dev is typing…"        ││   ← typing:update
│               │ ├────────────────────────────────────────────┤│
│               │ │ [VoiceComposer]  text input + 🎤 + send     ││   ← emits chat:message
│               │ └────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

Components: `AppSidebar` → `GroupsSidebar` (`NewGroupModal`, `GuestNameModal`), `GroupChatPage`
→ `ChatStream` → `GroupMessageRow[]`, `SessionCard`, `TypingIndicator`, `VoiceComposer`.
Real-time via Socket.IO (`chat:message`, `session:start`, `typing:update`).

---

#### Wireframe 2 — Agent Chat (`AgentChatPage`) — serves M6, M9, M12

What the user can do: talk to their **personal** AI agent by voice or text about what they want to
eat; watch the AI acknowledge and note extracted preferences; signal "I'm done." Which stories: M6
(voice/text preference input), M9 (understand reasoning), M12 (location only if given).

```
┌──────────────────────────────────────────────────────────────┐
│ AgentChatPage                                        [Done ✓]  │  ← PATCH members/me status
│ ┌───────────────────────────────┐  ┌───────────────────────┐  │
│ │ ChatStream (agent ↔ me)       │  │ NotedSoFarPanel        │  │
│ │  ChatMessage (agent): "No     │  │  • no sushi            │  │  ← extracted signals
│ │   sushi, something warm?"     │  │  • warm / cozy         │  │
│ │  ChatMessage (me): "ramen"    │  │  • budget: —           │  │
│ │  ChatMessage (agent): "Got it…"│ │ [GroupProgressPanel]   │  │  ← M7: who's ready
│ └───────────────────────────────┘  └───────────────────────┘  │
│ [VoiceComposer]  🎤 hold-to-talk  |  type a message  | send    │  ← POST /ai/analyze per turn
└──────────────────────────────────────────────────────────────┘
```

Components: `AgentChatPage` → `ChatStream` → `ChatMessage[]`, `NotedSoFarPanel`,
`GroupProgressPanel` (`MemberRoster`, `SegmentedProgress`), `VoiceComposer` (`useVoiceInput`).
Each user turn calls the **AI analyze** endpoint (see [AI Feature Specification](#ai-feature-specification)).

---

#### Wireframe 3 — Top Picks / Recommendations (`TopPicksPage`) — serves M8, M9, M11, M13

What the user can do: see the ranked group shortlist with a match score and a plain-language
justification, browse a pick's menu, add items to the shared cart, and (host) confirm the choice to
close the session. Which stories: M8 (group shortlist), M9 (why), M11 (shared cart), M13 (end &
save).

```
┌──────────────────────────────────────────────────────────────┐
│ TopPicksPage — "Your group's top picks"                        │
│ ┌────────────────────────────────────────────┐  ┌───────────┐ │
│ │ RankedRestaurantCard  #1  Nopa   [92% ▮]    │  │ CartDrawer│ │  ← MatchScoreBadge
│ │  "Vegan-friendly, mid-range, quiet."        │  │  CartItem │ │  ← justification (M9)
│ │  [TagRow] vegan · quiet · $$   [Vote ▲ 3]   │  │  CartItem │ │  ← M11 shared cart
│ │  [MenuList ▸ MenuItemRow…]  (expand)         │  │ CartSummary│ │  ← M10/M11
│ ├────────────────────────────────────────────┤  │  $  total │ │
│ │ RankedRestaurantCard  #2  …    [Vote ▲ 1]   │  └───────────┘ │
│ │ RankedRestaurantCard  #3  …                 │  [Confirm & ▶] │  ← host: POST /close (M13)
│ └────────────────────────────────────────────┘                │
└──────────────────────────────────────────────────────────────┘
```

Components: `TopPicksPage` → `RankedRestaurantCard[]` (`MatchScoreBadge`, `TagRow`, `VoteControl`,
`MenuList` → `MenuItemRow[]`), `CartDrawer` (`CartItemRow[]`, `CartSummary`). Fed by
`POST /api/sessions/:id/recommendations` → `RecommendationItem[]`.

---

### Cognitive walkthrough (to run before Sprint 1)

Show a non-pod user Wireframe 1 → 2 → 3 in sequence and have them narrate what they'd do. Target
gaps: (a) is "Start 🍔" discoverable as _begin a food session_? (b) on the agent screen, is it clear
the AI is **per-person**, not the group chat? (c) on Top Picks, is the match-score + justification
enough to build trust, and is "Confirm" obviously host-only? Record findings in the Decisions Log.

## Data Model

Postgres (with the `vector`/pgvector extension), mirrored from `backend/gateway/prisma/schema.prisma` (the source of truth). One table per object, plus join tables (`SessionMember`, `GroupMember`, `RecommendationItem`) that carry data _about_ a link. All primary keys are auto-increment integers; all field names are snake_case. Types marked `?` are nullable.

**Enums:** `Role` = `USER | OWNER | ADMIN`. `MessageType` = `TEXT | IMG | SYSTEM | SESSION_BLOCK`.

### `User` — an account on the platform

| column name     | type     | description                                                      |
| --------------- | -------- | ---------------------------------------------------------------- |
| id              | int      | primary key                                                      |
| username        | string   | unique login handle                                              |
| email           | string   | unique email address                                             |
| role            | Role     | account role (default `USER`)                                    |
| display_name    | string?  | display name                                                     |
| avatar_url      | string?  | avatar image URL                                                 |
| emailVerified   | bool     | whether the email is verified false; set true on Google sign-in) |
| displayUsername | string?  | non-normalized username for display                              |
| created_at      | datetime | row creation time                                                |
| updated_at      | datetime | last update time                                                 |

### `Profile` — a user's saved food preferences (1 : 0..1 with User)

| column name          | type     | description                                 |
| -------------------- | -------- | ------------------------------------------- |
| id                   | int      | primary key                                 |
| user_id              | int      | foreign key to User, unique; cascade delete |
| dietary_restrictions | string[] | e.g. `["nut-free","vegan"]`                 |
| disliked_cuisines    | string[] | cuisines to avoid                           |
| preferred_cuisines   | string[] | favored cuisines                            |
| budget_min           | int      | lower budget bound (per person)             |
| budget_max           | int      | upper budget bound (per person)             |
| liked_restaurant_ids | int[]    | denormalized list of restaurant IDs, no FK  |
| created_at           | datetime | row creation time                           |
| updated_at           | datetime | last update time                            |

### `Session` — a live restaurant-finding session

| column name  | type      | description                                      |
| ------------ | --------- | ------------------------------------------------ |
| id           | int       | primary key                                      |
| host_user_id | int       | foreign key to User (host)                       |
| group_id     | int?      | foreign key to originating Group; cascade delete |
| time_limit   | int       | session time limit                               |
| created_at   | datetime  | when the session started                         |
| closed_at    | datetime? | when the session was closed                      |
| avg_budget   | float     | averaged group budget                            |

### `SessionMember` — join table (User ↔ Session)

| column name | type     | description                                                  |
| ----------- | -------- | ------------------------------------------------------------ |
| session_id  | int      | foreign key to Session (composite PK); cascade delete        |
| user_id     | int      | foreign key to User (composite PK); cascade delete           |
| status      | bool     | ready flag — member finished sharing prefs (default `false`) |
| joined_at   | datetime | when the member joined the session                           |

Composite primary key `(session_id, user_id)`.

### `Qa` — one member's questionnaire answers for a session

| column name   | type    | description                            |
| ------------- | ------- | -------------------------------------- |
| id            | int     | primary key                            |
| session_id    | int     | foreign key to Session; cascade delete |
| occasion      | string? | occasion (e.g. "casual dinner")        |
| location_mode | string? | how location is chosen                 |
| location_lat  | float?  | latitude, only if provided             |
| location_lon  | float?  | longitude, only if provided            |
| radius_miles  | float?  | search radius in miles                 |
| time_slot     | string? | desired time                           |
| budget_min    | int?    | per-person lower budget                |
| budget_max    | int?    | per-person upper budget                |
| member_status | string? | free-form member status note           |

### `Event` — a finalized outing produced by closing a session

| column name     | type     | description                                        |
| --------------- | -------- | -------------------------------------------------- |
| id              | int      | primary key                                        |
| date            | datetime | date/time of the outing                            |
| address         | string   | outing address                                     |
| restaurant_id   | int      | foreign key to Restaurant                          |
| restaurant_name | string   | restaurant name snapshot (denormalized)            |
| group_id        | int?     | foreign key to Group; set null on group delete     |
| group_name      | string?  | group name snapshot; persists after group deletion |

Attendees: many-to-many with User via implicit join table `_EventAttendees`.

### `Restaurant` — a restaurant listing

| column name  | type          | description                                                                                 |
| ------------ | ------------- | ------------------------------------------------------------------------------------------- |
| id           | int           | primary key                                                                                 |
| name         | string        | restaurant name                                                                             |
| description  | string?       | description                                                                                 |
| cuisine_tags | string[]      | cuisine labels                                                                              |
| dietary_tags | string[]      | dietary labels (e.g. "vegan")                                                               |
| price_avg    | float?        | average price per person                                                                    |
| address      | string?       | street address                                                                              |
| lat          | float?        | latitude                                                                                    |
| long         | float?        | longitude                                                                                   |
| hours        | string?       | operating hours                                                                             |
| avg_rating   | float?        | average rating                                                                              |
| embedding    | vector(1024)? | pgvector embedding for similarity search (written via raw SQL, not the typed Prisma client) |
| created_at   | datetime      | row creation time                                                                           |
| updated_at   | datetime      | last update time                                                                            |

### `Recommendation` — a generated shortlist for a session

| column name | type     | description                            |
| ----------- | -------- | -------------------------------------- |
| id          | int      | primary key                            |
| session_id  | int      | foreign key to Session; cascade delete |
| created_at  | datetime | when generated                         |

### `RecommendationItem` — one restaurant in a recommendation (join table)

| column name       | type    | description                                   |
| ----------------- | ------- | --------------------------------------------- |
| id                | int     | primary key                                   |
| recommendation_id | int     | foreign key to Recommendation; cascade delete |
| restaurant_id     | int     | foreign key to Restaurant                     |
| match_score       | float?  | how well it fits the group                    |
| justification     | string? | why it was recommended                        |

### `Group` — a reusable set of friends/coworkers

| column name | type      | description                        |
| ----------- | --------- | ---------------------------------- |
| id          | int       | primary key                        |
| name        | string    | group name                         |
| created_at  | datetime  | row creation time                  |
| closed_at   | datetime? | when the group was closed, if ever |

### `GroupMember` — join table (User ↔ Group)

| column name | type     | description                                         |
| ----------- | -------- | --------------------------------------------------- |
| group_id    | int      | foreign key to Group (composite PK); cascade delete |
| user_id     | int      | foreign key to User (composite PK); cascade delete  |
| joined_at   | datetime | when the user joined the group                      |

Composite primary key `(group_id, user_id)`.

### `GroupMessage` — a message in a group's chat

| column name  | type        | description                          |
| ------------ | ----------- | ------------------------------------ |
| id           | int         | primary key                          |
| group_id     | int         | foreign key to Group; cascade delete |
| user_id      | int         | foreign key to User (author)         |
| content      | string      | message body                         |
| message_type | MessageType | message kind (default `TEXT`)        |
| created_at   | datetime    | when sent                            |

### Better Auth tables

> Managed by Better Auth (email/password + Google) in the gateway. Column names are **camelCase** (Better Auth convention), unlike the snake_case domain tables. The auth-session model is named `AuthSession` — not `Session` — to avoid colliding with the domain `Session` table.

### `Account` — a login method for a user (password or OAuth provider)

| column name           | type      | description                                                       |
| --------------------- | --------- | ----------------------------------------------------------------- |
| id                    | int       | primary key                                                       |
| accountId             | string    | provider's account id (user's id at Google; user id for password) |
| providerId            | string    | `"credential"` for email/password, `"google"` for Google          |
| userId                | int       | foreign key to User; cascade delete                               |
| password              | string?   | password hash — set only for the `credential` provider            |
| accessToken           | string?   | OAuth access token (Google)                                       |
| refreshToken          | string?   | OAuth refresh token (Google)                                      |
| idToken               | string?   | OAuth ID token (Google)                                           |
| accessTokenExpiresAt  | datetime? | access-token expiry                                               |
| refreshTokenExpiresAt | datetime? | refresh-token expiry                                              |
| scope                 | string?   | granted OAuth scopes                                              |
| createdAt             | datetime  | row creation time                                                 |
| updatedAt             | datetime  | last update time                                                  |

Indexed on `userId`. A user has one `Account` row per login method (e.g. both `credential` and `google` after linking).

### `AuthSession` — an active login session (cookie-backed)

| column name | type     | description                                          |
| ----------- | -------- | ---------------------------------------------------- |
| id          | int      | primary key                                          |
| token       | string   | unique session token (stored in the httpOnly cookie) |
| userId      | int      | foreign key to User; cascade delete                  |
| expiresAt   | datetime | when the session expires                             |
| ipAddress   | string?  | client IP at sign-in                                 |
| userAgent   | string?  | client user-agent at sign-in                         |
| createdAt   | datetime | row creation time                                    |
| updatedAt   | datetime | last update time                                     |

Unique on `token`; indexed on `userId`.

### `Verification` — verification tokens (email verification, etc.)

| column name | type     | description                           |
| ----------- | -------- | ------------------------------------- |
| id          | int      | primary key                           |
| identifier  | string   | what's being verified (e.g. an email) |
| value       | string   | the verification token/value          |
| expiresAt   | datetime | when the token expires                |
| createdAt   | datetime | row creation time                     |
| updatedAt   | datetime | last update time                      |

### Notes

- **`Profile.liked_restaurant_ids`** is a plain `int[]` (denormalized), not a managed relation — no FK integrity. Resolve separately: `prisma.restaurant.findMany({ where: { id: { in: profile.liked_restaurant_ids } } })`.
- **`Restaurant.embedding`** is an `Unsupported("vector(1024)")` pgvector column — it can't be read/written through the typed Prisma client, so embeddings are written with raw SQL (`::vector` cast).
- **Group deletion is asymmetric.** A `Session` is transient, so deleting its group **cascades**. An `Event` is a historical record, so deleting its group uses **SetNull** — the event survives with `group_id` null but keeps the `group_name` snapshot copied at creation.
- **Event creation flow:** all members fill the Q&A (or the session times out) → AI produces recommendations → the host confirms one → an `Event` is created, stamping `group_id` and copying the group's current `name` into `group_name`.

## Endpoints

Frontend-facing REST API exposed by the **gateway** under `/api`. All bodies/responses use **snake_case**; failures return `{ error: "<message>" }`. Every endpoint except `register`/`login` requires `Authorization: Bearer <jwt>` (implied `401` on missing/invalid token).

### Auth — `/api/auth`

> Served by **Better Auth** (mounted as a catch-all: `app.all('/api/auth/*', toNodeHandler(auth))`), **not** hand-written controllers. Email/password + username + Google, backed by an **httpOnly session cookie** — there is no JWT/Bearer token. Sign-in/up responses set the cookie and return the user; the browser then rides `withCredentials: true`. Request/response envelopes follow the Better Auth spec; the table lists the routes this app relies on, not an exhaustive set.

| CRUD   | HTTP Verb | Endpoint                     | Description                                                                                                             | Request Shape                           | Response Shape                                                           | Error Cases                                 | User Stories            |
| ------ | --------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------- | ----------------------- |
| Create | POST      | `/api/auth/sign-up/email`    | Register with email/password; sets session cookie. A hook derives a unique `username` from the email when none is given | `{ email, password, name?, username? }` | `{ user: { id, email, name, username, role, ... } }` + `Set-Cookie`      | 400 invalid field; 422 email/username taken | Account setup (prereq)  |
| Action | POST      | `/api/auth/sign-in/email`    | Authenticate by email; sets session cookie                                                                              | `{ email, password }`                   | `{ user: {...}, redirect? }` + `Set-Cookie`                              | 400 missing fields; 401 bad credentials     | Account access (prereq) |
| Action | POST      | `/api/auth/sign-in/username` | Authenticate by username (username plugin); sets session cookie                                                         | `{ username, password }`                | `{ user: {...} }` + `Set-Cookie`                                         | 400 missing fields; 401 bad credentials     | Account access (prereq) |
| Action | POST      | `/api/auth/sign-in/social`   | Begin Google OAuth; returns a redirect URL                                                                              | `{ provider: "google", callbackURL? }`  | `{ url, redirect: true }`                                                | 400 unknown provider                        | Google sign-in          |
| Action | GET       | `/api/auth/callback/google`  | Google OAuth callback; links to an existing same-email account, then sets session cookie and redirects                  | — (provider query params)               | `302` redirect + `Set-Cookie`                                            | 401 OAuth failure                           | Google sign-in          |
| Read   | GET       | `/api/auth/get-session`      | Current session + user from the cookie                                                                                  | —                                       | `{ session, user } \| null`                                              | —                                           | Session bootstrap       |
| Action | POST      | `/api/auth/sign-out`         | Clear the session cookie                                                                                                | —                                       | `{ success: true }` + cleared cookie                                     | —                                           | Sign out                |
| Read   | GET       | `/api/me`                    | Gateway convenience route: current user from the session cookie                                                         | —                                       | `{ user: { id, email, username, role, display_name, avatar_url, ... } }` | 401 not authenticated                       | Session bootstrap       |

### Profile — `/api/profile`

| CRUD   | HTTP Verb | Endpoint       | Description                          | Request Shape                                                                             | Response Shape                                                                                                                                       | Error Cases                                          | User Stories         |
| ------ | --------- | -------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------- |
| Read   | GET       | `/api/profile` | Get caller's preference profile      | —                                                                                         | `{ id, user_id, dietary_restrictions, disliked_cuisines, preferred_cuisines, budget_min, budget_max, liked_restaurant_ids, created_at, updated_at }` | 401 not authenticated; 404 no profile                | Set preferences once |
| Create | POST      | `/api/profile` | Create caller's profile (first time) | `{ dietary_restrictions, disliked_cuisines, preferred_cuisines, budget_min, budget_max }` | `{ ...profile }`                                                                                                                                     | 400 invalid/inverted budget; 401; 409 already exists | Set preferences once |
| Update | PUT       | `/api/profile` | Update caller's existing profile     | `{ dietary_restrictions, disliked_cuisines, preferred_cuisines, budget_min, budget_max }` | `{ ...profile }`                                                                                                                                     | 400 invalid/inverted budget; 401; 404 no profile     | Update anytime       |


### Groups — `/api/groups`

| CRUD   | HTTP Verb | Endpoint                                        | Description                                | Request Shape                     | Response Shape                                                                   | Error Cases                    | User Stories          |
| ------ | --------- | ----------------------------------------------- | ------------------------------------------ | --------------------------------- | -------------------------------------------------------------------------------- | ------------------------------ | --------------------- |
| Read   | GET       | `/api/groups`                                   | List groups caller belongs to              | —                                 | `[{ id, name, created_at, closed_at, member_count }]`                            | —                              | Reuse saved group     |
| Create | POST      | `/api/groups`                                   | Create group; caller added as first member | `{ name, member_ids? }`           | `{ id, name, created_at, closed_at, members: [{ user_id, joined_at }] }`         | 400 missing name               | Create a group        |
| Read   | GET       | `/api/groups/:group_id`                         | Group detail with members                  | —                                 | `{ id, name, ..., members: [{ user_id, display_name, avatar_url, joined_at }] }` | 403 not a member; 404          | Group detail          |
| Create | POST      | `/api/groups/:group_id/members`                 | Add a member (invite)                      | `{ user_id }` _or_ `{ username }` | `{ group_id, user_id, joined_at }`                                               | 403; 404; 409 already a member | Invite / join         |
| Delete | DELETE    | `/api/groups/:group_id/members/:user_id`        | Remove member (self = leave)               | —                                 | `204`                                                                            | 403; 404                       | Leave group           |
| Read   | GET       | `/api/groups/:group_id/messages?limit=&before=` | Paginated chat history (newest-first)      | —                                 | `[{ id, group_id, user_id, content, message_type, created_at }]`                 | 403 not a member               | Group chat history    |
| Create | POST      | `/api/groups/:group_id/messages`                | Persist a message                          | `{ content, message_type }`       | `{ id, group_id, user_id, content, message_type, created_at }`                   | 400 empty/bad type; 403        | Group chat            |
| Read   | GET       | `/api/groups/:group_id/sessions`                | Past & active sessions in group            | —                                 | `[{ id, host_user_id, time_limit, avg_budget, created_at, closed_at }]`          | 403                            | Session history       |
| Read   | GET       | `/api/groups/:group_id/events`                  | Finalized outings for group                | —                                 | `[{ id, date, address, restaurant_id, restaurant_name, group_id, group_name }]`  | 403                            | Remember where we ate |

### Sessions — `/api/sessions`

| CRUD   | HTTP Verb | Endpoint                                    | Description                                          | Request Shape                                                                                                      | Response Shape                                                                                                  | Error Cases                                         | User Stories             |
| ------ | --------- | ------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------ |
| Create | POST      | `/api/sessions`                             | Start a session (optionally from a group)            | `{ group_id?, time_limit, avg_budget }`                                                                            | `{ id, host_user_id, group_id, time_limit, avg_budget, created_at, closed_at, members: [{ user_id, status }] }` | 400 invalid; 403 not in group; 404                  | Start session from group |
| Read   | GET       | `/api/sessions/:session_id`                 | Session with members & readiness                     | —                                                                                                                  | `{ ...session, members: [{ user_id, display_name, status, joined_at }] }`                                       | 403; 404                                            | Session view             |
| Create | POST      | `/api/sessions/:session_id/members`         | Join session (status=false)                          | —                                                                                                                  | `{ session_id, user_id, status, joined_at }`                                                                    | 404; 409 already joined; 400 closed                 | Join session             |
| Read   | GET       | `/api/sessions/:session_id/members`         | Members & readiness (poll)                           | —                                                                                                                  | `[{ user_id, display_name, status, joined_at }]`                                                                | 403                                                 | See who's ready          |
| Update | PATCH     | `/api/sessions/:session_id/members/me`      | Set caller's ready status                            | `{ status }`                                                                                                       | `{ session_id, user_id, status, joined_at }`                                                                    | 403; 404                                            | Signal I'm done          |
| Create | POST      | `/api/sessions/:session_id/qa`              | Submit occasion/location/time/budget answers         | `{ occasion?, location_mode?, location_lat?, location_lon?, radius_miles?, time_slot?, budget_min?, budget_max? }` | `{ ...qa }`                                                                                                     | 400 invalid range; 403                              | Share prefs, no form     |
| Action | POST      | `/api/sessions/:session_id/recommendations` | Run orchestrator, return ranked shortlist _(exists)_ | `{ force_partial? }`                                                                                               | `{ id, session_id, created_at, items: [{ restaurant_id, name, match_score, justification }] }`                  | 400 bad id; 409 members not confirmed; 502 upstream | Group shortlist + why    |
| Read   | GET       | `/api/sessions/:session_id/recommendations` | Fetch latest stored recommendation                   | —                                                                                                                  | `{ id, session_id, created_at, items: [...] }`                                                                  | 404 none yet                                        | Re-view shortlist        |
| Action | POST      | `/api/sessions/:session_id/close`           | Close session, create Event from choice              | `{ restaurant_id, date, address }`                                                                                 | `{ session: {...}, event: { id, restaurant_id, restaurant_name, ... } }`                                        | 400; 403 host only; 409 already closed              | End & save result        |
| Read   | GET       | `/api/sessions/:session_id/summary`         | Compact recap of a closed session                    | —                                                                                                                  | `{ session_id, closed_at, chosen: { restaurant_id, name }, attendees, reason }`                                 | 404; 409 not closed                                 | Summary of decision      |

### Restaurants — `/api/restaurants`

| CRUD   | HTTP Verb | Endpoint                                                          | Description                                           | Request Shape                                                                                                  | Response Shape                                                                                              | Error Cases      | User Stories         |
| ------ | --------- | ----------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------- | -------------------- |
| Read   | GET       | `/api/restaurants?q=&cuisine=&dietary=&price_max=&limit=&offset=` | Browse/filter restaurants                             | —                                                                                                              | `[{ id, name, description, cuisine_tags, dietary_tags, price_avg, address, lat, long, hours, avg_rating }]` | —                | Restaurant discovery |
| Read   | GET       | `/api/restaurants/:restaurant_id`                                 | Restaurant detail                                     | —                                                                                                              | `{ ...restaurant }`                                                                                         | 404              | Restaurant detail    |
| Create | POST      | `/api/restaurants/:restaurant_id/like`                            | Like (append to profile), idempotent                  | —                                                                                                              | `{ liked_restaurant_ids: [...] }`                                                                           | 404              | Feed long-term prefs |
| Delete | DELETE    | `/api/restaurants/:restaurant_id/like`                            | Unlike                                                | —                                                                                                              | `{ liked_restaurant_ids: [...] }`                                                                           | 404              | Feed long-term prefs |
| Create | POST      | `/api/restaurants`                                                | Create restaurant, then embed _(exists; owner/admin)_ | `{ name, description?, cuisine_tags?, dietary_tags?, price_avg?, address?, lat?, long?, hours?, avg_rating? }` | `{ ...restaurant }`                                                                                         | 400 missing name | Listing management   |

### Events — `/api/events`

| CRUD | HTTP Verb | Endpoint      | Description                      | Request Shape | Response Shape                                                                  | Error Cases | User Stories   |
| ---- | --------- | ------------- | -------------------------------- | ------------- | ------------------------------------------------------------------------------- | ----------- | -------------- |
| Read | GET       | `/api/events` | Past outings the caller attended | —             | `[{ id, date, address, restaurant_id, restaurant_name, group_id, group_name }]` | —           | Dining history |

## State Architecture

GrubGroup keeps most shared data in **Zustand stores** — standalone "boxes" of state any component can read directly, so we skip prop-drilling and React Context (and use a `navStore` instead of a router). Each store owns one concern: `authStore`, `cartStore`, `sessionStore`, etc.

Auth is the exception: the gateway (Express) manages login with **Better Auth** and gives the browser an httpOnly cookie it can't read. The app calls **`useSession()`** to ask "who am I?" and mirrors that into `authStore`. In the **Owner** column, most rows are a _store_; a few (like `AuthPage`) are a _component_ — throwaway form fields only one screen needs.

### Global state (Zustand stores + auth session)

| State Variable             | Type                             | Initial Value                      | Owner                | Trigger                                         |
| -------------------------- | -------------------------------- | ---------------------------------- | -------------------- | ----------------------------------------------- |
| `user`                     | `User \| null`                   | `null` (live) / `MOCK_USER` (mock) | authStore            | Better Auth session change, guest login, logout |
| `role`                     | `Role \| null`                   | `null`                             | authStore            | Set alongside `user`                            |
| `isGuest`                  | `boolean`                        | `false`                            | authStore            | Guest login / real session                      |
| `session` (Better Auth)    | `object \| null`                 | `null`                             | `useSession()` (App) | Sign-in / sign-out, cookie refresh              |
| `screen`                   | `Screen` (union)                 | `'sign-in'`                        | navStore             | Navigation (`go()`)                             |
| `groupId`                  | `number`                         | `7`                                | navStore             | Selecting a group (`setGroup()`)                |
| `groups`                   | `Group[]`                        | `MOCK_GROUPS`                      | groupsStore          | Create group (`addGroup`)                       |
| `profile`                  | `Profile \| null`                | `null`                             | profileStore         | Fetch on load; edit prefs; save                 |
| `preferredLocation`        | `LocationPref \| undefined`      | `undefined`                        | profileStore         | Location autocomplete (client-only)             |
| `loading` / `saving`       | `boolean`                        | `false`                            | profileStore         | Profile API call start/end                      |
| `byId`                     | `Record<number, Restaurant>`     | `{}`                               | restaurantStore      | Fetch restaurants                               |
| `menus`                    | `Record<number, MenuItem[]>`     | `{}`                               | restaurantStore      | Fetch a restaurant's menu                       |
| `loaded`                   | `boolean`                        | `false`                            | restaurantStore      | Restaurants fetched                             |
| `session`                  | `Session \| null`                | `null`                             | sessionStore         | Load session                                    |
| `members`                  | `SessionMember[]`                | `[]`                               | sessionStore         | Load, join, member marks done                   |
| `recommendation`           | `Recommendation \| null`         | `null`                             | sessionStore         | Fetch recommendation                            |
| `phase`                    | `SessionPhase` (union)           | `'joining'`                        | sessionStore         | Derived UI state (join → picks → complete)      |
| `votes`                    | `Record<number, number[]>`       | `{}`                               | sessionStore         | Cast / un-cast a vote                           |
| `chosenRestaurantId`       | `number \| null`                 | `null`                             | sessionStore         | Host picks a restaurant                         |
| `currentUserId`            | `number`                         | `1`                                | sessionStore         | Set on session load                             |
| `items` (cart)             | `CartItem[]`                     | `[]`                               | cartStore            | Add / remove / update qty                       |
| `messages` (agent)         | `ChatMessage[]`                  | `[]`                               | chatStore            | Seed, user sends, agent reply                   |
| `notedPreferences`         | `NotedPref[]`                    | `[]`                               | chatStore            | Seeded from agent chat                          |
| `replyIndex`               | `number`                         | `0`                                | chatStore            | Each user message (cycles mock replies)         |
| `messagesByGroup`          | `Record<number, GroupMessage[]>` | `{}`                               | groupChatStore       | Socket.IO `chat:message` echo                   |
| `sessionStartIndexByGroup` | `Record<number, number \| null>` | `{}`                               | groupChatStore       | Socket.IO `session:start` echo                  |

### Component-local state (`useState`)

| State Variable | Type             | Initial Value                              | Owner                 | Trigger                                    |
| -------------- | ---------------- | ------------------------------------------ | --------------------- | ------------------------------------------ |
| `fullName`     | `string`         | `''`                                       | AuthPage              | User input (sign-up)                       |
| `username`     | `string`         | `''`                                       | AuthPage              | User input (sign-up)                       |
| `email`        | `string`         | `''`                                       | AuthPage              | User input (sign-up)                       |
| `identifier`   | `string`         | `''`                                       | AuthPage              | User input (sign-in: username or email)    |
| `password`     | `string`         | `''`                                       | AuthPage              | User input                                 |
| `error`        | `string \| null` | `null`                                     | AuthPage              | Auth request failure                       |
| `loading`      | `boolean`        | `false`                                    | AuthPage              | Auth request start/end                     |
| `selectedId`   | `number \| null` | `null`                                     | TopPicksPage          | Picking a restaurant card                  |
| `text`         | `string`         | `''`                                       | VoiceComposer         | Typing in the message bar; cleared on send |
| `modalOpen`    | `boolean`        | `false`                                    | GroupsSidebar         | Open/close "New group" modal               |
| `name`         | `string`         | `''`                                       | NewGroupModal         | Typing the new group name                  |
| `name`         | `string`         | `''`                                       | GuestNameModal        | Typing the guest name                      |
| `value`        | `string`         | `initial` arg (e.g. `'San Francisco, CA'`) | usePlacesInput (hook) | Location autocomplete typing               |

The major decisions nailed down: **authentication state lives in Better Auth's cookie session** (mirrored into `authStore`, so there's one source of truth that survives refresh); **live data re-fetches** are triggered by store `load*` actions hitting the gateway; and **real-time group chat / session sync flows in over Socket.IO** into `groupChatStore`. State flows out of the stores via hooks — components subscribe to the slices they need instead of prop-drilling from a single top-level owner.

## AI Feature Specification

GrubGroup's core value **is** AI. There are two meaningful AI features; **the Group
Recommendation Orchestrator is the MVP-critical one** and is already partially implemented, so it
is specified first and in the most detail. All AI calls run **server-side in `ai_service`** (never
the browser) — API keys, restaurant data, and other members' dietary data never reach the client.
The gateway proxies these calls; the frontend only ever calls the gateway.

> **Architecture note (why backend):** the AI provider key and every member's raw dietary/allergy
> data stay on the server. The browser only receives ranked restaurant IDs + justifications, so no
> member's private preferences are exposed to other members' clients.

### Feature 1 — Group Recommendation Orchestrator ⭐ (MVP)

**What it does (user's words):** "Show me a shortlist of restaurants that work for my whole group,
and tell me why each one fits." — serves **M8, M9**.

**Where it lives:** triggered from `TopPicksPage` (or automatically when the last member marks
ready on `AgentChatPage`/`GroupChatPage`). The gateway route fans out to the `ai_service` LangGraph
pipeline.

**Endpoint:** `POST /api/sessions/:session_id/recommendations` (gateway) →
`POST /api/v1/sessions/{session_id}/recommendations` (`ai_service`, `X-Internal-Secret` guarded).
See [Sessions API contract](#sessions--apisessions). **Status:** _implemented._

**Input (what the pipeline assembles server-side from the DB, not from the client):**

- All confirmed `SessionMember`s and their `Profile`s (dietary restrictions, disliked/preferred
  cuisines, budget range, liked restaurant IDs).
- Each member's session `Qa` row (occasion, location mode + lat/lon + radius, time slot, budget).
- The candidate `Restaurant` pool retrieved via pgvector similarity + hard filters.
- Request body from the client is only `{ force_partial?: boolean }` (bypass the all-confirmed
  guard for a partial run).

**Pipeline (LangGraph):**

1. **Fan-out** — one preference-normalization node per member (`preference_agent`) → `MemberPref`.
2. **Reconcile** — union of hard dietary restrictions, min of budget caps, weighted cuisine
   preferences, geo center + radius from `Qa`.
3. **Retrieve** — embed the reconciled query (Qwen3, 1024-dim) and run pgvector cosine search with
   **hard filters pushed into SQL**: dietary-tag superset match, price cap, geo bounding box.
4. **Re-rank** — LLM (Salesforce gateway → Claude) scores/justifies the candidates by soft signals
   (cuisine fit, rating, proximity, occasion).
5. **Persist** — write `Recommendation` + `RecommendationItem[]`; return the ranked list.

**Output shape:**

```json
{
  "id": 42,
  "session_id": 7,
  "created_at": "2026-07-10T19:00:00Z",
  "items": [
    {
      "restaurant_id": 001,
      "name": "Nopa",
      "match_score": 0.94,
      "justification": "Vegan-friendly menu, mid-range, quiet enough to talk."
    }
  ]
}
```

`match_score` ∈ [0, 1]; `justification` ≤ 240 chars.

**Validation — what makes a response good vs. bad:**

- **Hard-constraint safety (must-pass):** _no_ returned restaurant may violate any member's hard
  dietary restriction. This is enforced in SQL before the LLM sees candidates, and spot-checked in
  the response. A single violation = bad response (this is the failure admins watch for, A4).
- **Well-formed:** valid JSON, 1–5 items, every `restaurant_id` exists in the candidate pool
  (no hallucinated restaurants), `match_score` in range, non-empty justification.
- **Relevant:** justification references a real group signal (a cuisine, budget, or dietary need
  that was actually in the inputs) rather than generic filler.
- **How we'll know:** `scripts/smoke_orchestrator.py` + `scripts/live_http_gateway_e2e.py` assert
  the shape and that items come from seeded data; manual review of justifications against known
  member prefs during Sprint 2.

**Fallback (AI call fails or returns nothing parseable):** the orchestrator falls back to
**embedding-distance ranking** (the pgvector cosine order) with a templated justification, so the
user still gets a valid shortlist. If retrieval itself fails, the gateway returns the upstream
status (`502`) and `TopPicksPage` shows a "personalized ranking temporarily unavailable — showing
basic matches" banner over the rule-filtered list. Members not confirmed → `409` (not an error
state; the UI shows "waiting on N members").

### Feature 2 — Personal Preference Agent (voice/text extraction)

**What it does (user's words):** "Let me just say what I'm in the mood for, and have it understood
and remembered." — serves **M6, M9, M12**.

**Where it lives:** `AgentChatPage`, on every user turn (voice or text via `VoiceComposer`).

**Endpoint (planned):** `POST /api/ai/analyze` (gateway) → `ai_service` (extends `ai.py`).
_Status: proposal-sketched, targeted Sprint 2._ See `planning/project_proposal.md` for the full
request/response sketch.

**Input:** `{ user_id, session_id | null, message, message_source: "voice"|"text",
conversation_history: [{role, content}], current_profile }`.

**Output:** structured `extracted_signals` (cuisine inclinations/exclusions, vibe, noise tolerance,
new dietary flags, and `location_intent: { mode: "named"|"realtime"|"unset", resolved_label }`),
plus `profile_updated`, a natural-language `agent_reply`, and `missing_signals[]`.

**Validation:** strict JSON-only from the model; extracted dietary flags never _silently_ override
existing hard restrictions (additive/confirmation only); location is captured **only** when the
user expresses it (`unset` by default — never proactively prompt for GPS — enforces M12); the
`agent_reply` acknowledges what was understood and asks for the top missing signal.

**Fallback:** on failure, save the raw message as a plain session note (no structured extraction);
the orchestrator skips this member's structured signals but does **not** block the session; UI
banner: "We saved your message as a note."

### Feature 3 — Session Summary _(stretch)_

One-sentence: "Remind me how we decided on this place." — serves **M14**. `GET /summaries/:id`,
generated async on session close and cached server-side so every member sees the same recap.
Fallback: a structured recap (restaurant, occasion, size, date) designed to look intentional.
_Status: proposal-sketched, stretch._

#### AI Feature Decisions Log

| Decision                                                                            | Sprint              | What changed   | Why                                                                                                                                  |
| ----------------------------------------------------------------------------------- | ------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Push hard dietary/price/geo filters into SQL **before** the LLM re-rank             | Sprint 0 (scaffold) | Architecture   | Guarantees the LLM can't surface a restaurant that violates a hard restriction; makes the safety property enforceable, not hoped-for |
| Distance-ranked fallback when the LLM returns nothing parseable                     | Sprint 0 (scaffold) | Error handling | A blank shortlist is worse than an un-explained-but-valid one; keeps the core flow alive on LLM hiccups                              |
| Catch `openai.APIConnectionError`/`APITimeoutError` explicitly → 502                | Sprint 0 (scaffold) | Error handling | These don't subclass `OSError`, so they'd fall through to 500 and break the gateway's status passthrough                             |
| _(pending)_ Include recent session/conversation history as context in `/ai/analyze` | Sprint 2            | Prompt design  | TBD — initial extraction may be too generic without it                                                                               |

## Sprint Plan & Milestones

Each week is a sprint; **MVP target = end of Sprint 2**. Every GitHub issue references the spec
section it touches (a screen, an endpoint, a schema entity, or a story ID) for traceability.

### Milestone: Sprint 1 — Foundations & Profiles

_Goal: a logged-in member can set a profile and create/see a group._

- Auth end-to-end (Better Auth sign-up/in, Google, session bootstrap) — stories: prereq
- Profile onboarding + edit (`Onboarding1–3`, `GET/PUT /api/profile`) — **M1, M2**
- Groups: create, list, detail, membership (`/api/groups*`) — **M3**
- Data layer: Prisma schema + seeded restaurants live; `ai_service` read-mirror — supports all

### Milestone: Sprint 2 — MVP: the core loop 🎯

_Goal: a group starts a session, everyone shares prefs, and sees an explained shortlist._

- Group chat room + real-time (Socket.IO) — **M4, M5, M7**
- Personal agent chat + `POST /api/ai/analyze` — **M6**
- Start session / join / readiness / Q&A (`/api/sessions*`) — **M5, M7**
- **Group recommendation orchestrator** wired to `TopPicksPage` — **M8, M9** _(pipeline exists)_

### Milestone: Sprint 3 — Cart, close, history

_Goal: pick a place, order together, save the result._

- Menu browse + shared cart (`cartStore`, `MenuList`) — **M10, M11**
- Location-aware search (only when given) — **M12**
- Close session → create `Event`; session summary — **M13, M14**
- Group session history & events (`EventsPage`) — **M15**

### Milestone: Sprint 4 — Admin & hardening

_Goal: platform trust + polish._

- Admin moderation queue + approve/reject (`/api/admin*`) — **A1–A3**
- AI audit log / session traces — **A4**
- Role management — **A5**
- Quality pass: error states, empty states, loading states

### Stretch / Backlog

Restaurant-owner surfaces (**O1–O5**), AI menu-photo extraction, session summaries, ratings feeding
long-term prefs, delivery integration.

### GitHub setup checklist

- [ ] Create the 4 Milestones above (Sprint 1–4).
- [ ] One issue per story (title references the story ID), assigned to its Milestone.
- [ ] Each issue body links the spec section it touches (endpoint / screen / schema entity).
- [ ] Project Board columns: **Backlog → Sprint (To do) → In progress → In review → Done**.
- [ ] Paste the board URL(s) into [Project Links](#project-links) (GitHub board **and** Notion board).

## Decisions Log

Standing, team-owned record maintained across all four sprints. Add an entry whenever the team
makes a decision worth remembering — especially ones not obvious from the code. Update after pod
syncs, spec audits, and any time a feature is cut/changed/added, then commit.

| Decision                                                                                             | Context                                                                                    | Alternatives considered                                         | Tradeoffs                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Split the backend into a **gateway (Node) + ai_service (Python/FastAPI)**, both hitting one Postgres | Wanted JS real-time + JS auth ergonomics _and_ Python's AI/LangGraph ecosystem             | Single Node backend calling a hosted LLM; single Python backend | More moving parts + a shared-secret hop, but each service uses its best-fit ecosystem; Python owns the AI pipeline cleanly                                                                                            |
| **Prisma owns the schema; `ai_service` is a read-side SQLModel mirror** (no `create_all`/Alembic)    | Two languages, one DB — need a single source of truth for DDL                              | Each service migrates independently; a separate schema service  | One place for migrations (gateway/prisma); ai_service must keep its mirror in sync by hand, but no dual-write DDL drift                                                                                               |
| Adopt **Better Auth (cookie sessions)** and drop hand-rolled JWT minting                             | Auth stubs were empty; Better Auth gives email/password + Google + sessions out of the box | Custom `jsonwebtoken` + bcrypt; Auth0/Clerk                     | Gained email verification/OAuth/session revocation fast; `JWT_SECRET` now means only the internal-hop secret, and the auth-session table had to be renamed `AuthSession` to avoid colliding with the domain `Session` |
| **`?as=N` dev impersonation** for the live-chat demo                                                 | Needed two "users" in two browser tabs before real multi-account auth flows were exercised | Spin up two real accounts each demo                             | Fast scripted demo; must be removed before any real deployment                                                                                                                                                        |
| **Screen-based `navStore` instead of react-router**                                                  | Flows are a linear session state machine, not deep-linkable pages (yet)                    | `react-router-dom`                                              | Simpler state-driven navigation now; will need a router if/when we want shareable URLs / deep links                                                                                                                   |
| _(template)_ Cut / change / add …                                                                    | what prompted it                                                                           | what else we could have done                                    | what we gained / gave up                                                                                                                                                                                              |

**_Don't forget to keep Issues, Milestones, and the Project Board in sync with this spec — when an issue closes, the spec should reflect what was built._**

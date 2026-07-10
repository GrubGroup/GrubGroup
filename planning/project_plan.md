# Project Plan

Pod Members: **Daniel Lam, Della Lee, Audrey Dequito, Miguel Cuevas**

## Problem Statement and Description

Problem Statement: Streamlining the process finding a restaurant between people (groups or 1:1) based on a questionnaire & constantly updated profiles.

A Group Based AI Food Planner:
A consumer-facing, "voice-first" web app where a group of friends each talk to their own AI agent about what they want to eat. A master AI orchestrator agent collects everyone's dietary preferences, budget, and location in real-time, finds restaurants that satisfy the whole group, lets each person browse and order from a shared menu, and connects everything into one group cart. This is all driven by a conversational, voice-enabled interface. Think Uber Eats but a group chat based on preference based on profile information

## User Roles and Personas

User Roles:

Include the most up-to-date user roles and personas.

## User Stories

List the current user stories you will implement.

## Pages/Screens

List all the pages and screens in the app. Include wireframes for at least 3 of them.

## Data Model

Postgres (with the `vector`/pgvector extension), mirrored from `backend/gateway/prisma/schema.prisma` (the source of truth). One table per object, plus join tables (`SessionMember`, `GroupMember`, `RecommendationItem`) that carry data *about* a link. All primary keys are auto-increment integers; all field names are snake_case. Types marked `?` are nullable.

**Enums:** `Role` = `USER | OWNER | ADMIN`. `MessageType` = `TEXT | IMG | SYSTEM | SESSION_BLOCK`.

### `User` — an account on the platform

| column name | type | description |
| --- | --- | --- |
| id | int | primary key |
| username | string | unique login handle |
| email | string | unique email address |
| role | Role | account role (default `USER`) |
| display_name | string? | display name |
| avatar_url | string? | avatar image URL |
| emailVerified | bool | whether the email is verified false; set true on Google sign-in) |
| displayUsername | string? | non-normalized username for display |
| created_at | datetime | row creation time |
| updated_at | datetime | last update time |

### `Profile` — a user's saved food preferences (1 : 0..1 with User)

| column name | type | description |
| --- | --- | --- |
| id | int | primary key |
| user_id | int | foreign key to User, unique; cascade delete |
| dietary_restrictions | string[] | e.g. `["nut-free","vegan"]` |
| disliked_cuisines | string[] | cuisines to avoid |
| preferred_cuisines | string[] | favored cuisines |
| budget_min | int | lower budget bound (per person) |
| budget_max | int | upper budget bound (per person) |
| liked_restaurant_ids | int[] | denormalized list of restaurant IDs, no FK |
| created_at | datetime | row creation time |
| updated_at | datetime | last update time |

### `Session` — a live restaurant-finding session

| column name | type | description |
| --- | --- | --- |
| id | int | primary key |
| host_user_id | int | foreign key to User (host) |
| group_id | int? | foreign key to originating Group; cascade delete |
| time_limit | int | session time limit |
| created_at | datetime | when the session started |
| closed_at | datetime? | when the session was closed |
| avg_budget | float | averaged group budget |

### `SessionMember` — join table (User ↔ Session)

| column name | type | description |
| --- | --- | --- |
| session_id | int | foreign key to Session (composite PK); cascade delete |
| user_id | int | foreign key to User (composite PK); cascade delete |
| status | bool | ready flag — member finished sharing prefs (default `false`) |
| joined_at | datetime | when the member joined the session |

Composite primary key `(session_id, user_id)`.

### `Qa` — one member's questionnaire answers for a session

| column name | type | description |
| --- | --- | --- |
| id | int | primary key |
| session_id | int | foreign key to Session; cascade delete |
| occasion | string? | occasion (e.g. "casual dinner") |
| location_mode | string? | how location is chosen |
| location_lat | float? | latitude, only if provided |
| location_lon | float? | longitude, only if provided |
| radius_miles | float? | search radius in miles |
| time_slot | string? | desired time |
| budget_min | int? | per-person lower budget |
| budget_max | int? | per-person upper budget |
| member_status | string? | free-form member status note |

### `Event` — a finalized outing produced by closing a session

| column name | type | description |
| --- | --- | --- |
| id | int | primary key |
| date | datetime | date/time of the outing |
| address | string | outing address |
| restaurant_id | int | foreign key to Restaurant |
| restaurant_name | string | restaurant name snapshot (denormalized) |
| group_id | int? | foreign key to Group; set null on group delete |
| group_name | string? | group name snapshot; persists after group deletion |

Attendees: many-to-many with User via implicit join table `_EventAttendees`.

### `Restaurant` — a restaurant listing

| column name | type | description |
| --- | --- | --- |
| id | int | primary key |
| name | string | restaurant name |
| description | string? | description |
| cuisine_tags | string[] | cuisine labels |
| dietary_tags | string[] | dietary labels (e.g. "vegan") |
| price_avg | float? | average price per person |
| address | string? | street address |
| lat | float? | latitude |
| long | float? | longitude |
| hours | string? | operating hours |
| avg_rating | float? | average rating |
| embedding | vector(1024)? | pgvector embedding for similarity search (written via raw SQL, not the typed Prisma client) |
| created_at | datetime | row creation time |
| updated_at | datetime | last update time |

### `Recommendation` — a generated shortlist for a session

| column name | type | description |
| --- | --- | --- |
| id | int | primary key |
| session_id | int | foreign key to Session; cascade delete |
| created_at | datetime | when generated |

### `RecommendationItem` — one restaurant in a recommendation (join table)

| column name | type | description |
| --- | --- | --- |
| id | int | primary key |
| recommendation_id | int | foreign key to Recommendation; cascade delete |
| restaurant_id | int | foreign key to Restaurant |
| match_score | float? | how well it fits the group |
| justification | string? | why it was recommended |

### `Group` — a reusable set of friends/coworkers

| column name | type | description |
| --- | --- | --- |
| id | int | primary key |
| name | string | group name |
| created_at | datetime | row creation time |
| closed_at | datetime? | when the group was closed, if ever |

### `GroupMember` — join table (User ↔ Group)

| column name | type | description |
| --- | --- | --- |
| group_id | int | foreign key to Group (composite PK); cascade delete |
| user_id | int | foreign key to User (composite PK); cascade delete |
| joined_at | datetime | when the user joined the group |

Composite primary key `(group_id, user_id)`.

### `GroupMessage` — a message in a group's chat

| column name | type | description |
| --- | --- | --- |
| id | int | primary key |
| group_id | int | foreign key to Group; cascade delete |
| user_id | int | foreign key to User (author) |
| content | string | message body |
| message_type | MessageType | message kind (default `TEXT`) |
| created_at | datetime | when sent |

### Better Auth tables
> Managed by Better Auth (email/password + Google) in the gateway. Column names are **camelCase** (Better Auth convention), unlike the snake_case domain tables. The auth-session model is named `AuthSession` — not `Session` — to avoid colliding with the domain `Session` table.

### `Account` — a login method for a user (password or OAuth provider)

| column name | type | description |
| --- | --- | --- |
| id | int | primary key |
| accountId | string | provider's account id (user's id at Google; user id for password) |
| providerId | string | `"credential"` for email/password, `"google"` for Google |
| userId | int | foreign key to User; cascade delete |
| password | string? | password hash — set only for the `credential` provider |
| accessToken | string? | OAuth access token (Google) |
| refreshToken | string? | OAuth refresh token (Google) |
| idToken | string? | OAuth ID token (Google) |
| accessTokenExpiresAt | datetime? | access-token expiry |
| refreshTokenExpiresAt | datetime? | refresh-token expiry |
| scope | string? | granted OAuth scopes |
| createdAt | datetime | row creation time |
| updatedAt | datetime | last update time |

Indexed on `userId`. A user has one `Account` row per login method (e.g. both `credential` and `google` after linking).

### `AuthSession` — an active login session (cookie-backed)

| column name | type | description |
| --- | --- | --- |
| id | int | primary key |
| token | string | unique session token (stored in the httpOnly cookie) |
| userId | int | foreign key to User; cascade delete |
| expiresAt | datetime | when the session expires |
| ipAddress | string? | client IP at sign-in |
| userAgent | string? | client user-agent at sign-in |
| createdAt | datetime | row creation time |
| updatedAt | datetime | last update time |

Unique on `token`; indexed on `userId`.

### `Verification` — verification tokens (email verification, etc.)

| column name | type | description |
| --- | --- | --- |
| id | int | primary key |
| identifier | string | what's being verified (e.g. an email) |
| value | string | the verification token/value |
| expiresAt | datetime | when the token expires |
| createdAt | datetime | row creation time |
| updatedAt | datetime | last update time |

### Notes

- **`Profile.liked_restaurant_ids`** is a plain `int[]` (denormalized), not a managed relation — no FK integrity. Resolve separately: `prisma.restaurant.findMany({ where: { id: { in: profile.liked_restaurant_ids } } })`.
- **`Restaurant.embedding`** is an `Unsupported("vector(1024)")` pgvector column — it can't be read/written through the typed Prisma client, so embeddings are written with raw SQL (`::vector` cast).
- **Group deletion is asymmetric.** A `Session` is transient, so deleting its group **cascades**. An `Event` is a historical record, so deleting its group uses **SetNull** — the event survives with `group_id` null but keeps the `group_name` snapshot copied at creation.
- **Event creation flow:** all members fill the Q&A (or the session times out) → AI produces recommendations → the host confirms one → an `Event` is created, stamping `group_id` and copying the group's current `name` into `group_name`.

## Endpoints

Frontend-facing REST API exposed by the **gateway** under `/api`. All bodies/responses use **snake_case**; failures return `{ error: "<message>" }`. Every endpoint except `register`/`login` requires `Authorization: Bearer <jwt>` (implied `401` on missing/invalid token).

### Auth — `/api/auth`

### Auth — `/api/auth`

> Served by **Better Auth** (mounted as a catch-all: `app.all('/api/auth/*', toNodeHandler(auth))`), **not** hand-written controllers. Email/password + username + Google, backed by an **httpOnly session cookie** — there is no JWT/Bearer token. Sign-in/up responses set the cookie and return the user; the browser then rides `withCredentials: true`. Request/response envelopes follow the Better Auth spec; the table lists the routes this app relies on, not an exhaustive set.

| CRUD | HTTP Verb | Endpoint | Description | Request Shape | Response Shape | Error Cases | User Stories |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Create | POST | `/api/auth/sign-up/email` | Register with email/password; sets session cookie. A hook derives a unique `username` from the email when none is given | `{ email, password, name?, username? }` | `{ user: { id, email, name, username, role, ... } }` + `Set-Cookie` | 400 invalid field; 422 email/username taken | Account setup (prereq) |
| Action | POST | `/api/auth/sign-in/email` | Authenticate by email; sets session cookie | `{ email, password }` | `{ user: {...}, redirect? }` + `Set-Cookie` | 400 missing fields; 401 bad credentials | Account access (prereq) |
| Action | POST | `/api/auth/sign-in/username` | Authenticate by username (username plugin); sets session cookie | `{ username, password }` | `{ user: {...} }` + `Set-Cookie` | 400 missing fields; 401 bad credentials | Account access (prereq) |
| Action | POST | `/api/auth/sign-in/social` | Begin Google OAuth; returns a redirect URL | `{ provider: "google", callbackURL? }` | `{ url, redirect: true }` | 400 unknown provider | Google sign-in |
| Action | GET | `/api/auth/callback/google` | Google OAuth callback; links to an existing same-email account, then sets session cookie and redirects | — (provider query params) | `302` redirect + `Set-Cookie` | 401 OAuth failure | Google sign-in |
| Read | GET | `/api/auth/get-session` | Current session + user from the cookie | — | `{ session, user } \| null` | — | Session bootstrap |
| Action | POST | `/api/auth/sign-out` | Clear the session cookie | — | `{ success: true }` + cleared cookie | — | Sign out |
| Read | GET | `/api/me` | Gateway convenience route: current user from the session cookie | — | `{ user: { id, email, username, role, display_name, avatar_url, ... } }` | 401 not authenticated | Session bootstrap |

### Profile — `/api/profile`

| CRUD | HTTP Verb | Endpoint | Description | Request Shape | Response Shape | Error Cases | User Stories |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Read | GET | `/api/profile` | Get caller's preference profile | — | `{ id, user_id, dietary_restrictions, disliked_cuisines, preferred_cuisines, budget_min, budget_max, liked_restaurant_ids, created_at, updated_at }` | 404 no profile | Set preferences once |
| Create/Update | PUT | `/api/profile` | Upsert caller's profile | `{ dietary_restrictions, disliked_cuisines, preferred_cuisines, budget_min, budget_max }` | `{ ...profile }` | 400 invalid/inverted budget | Set once; update anytime |

### Groups — `/api/groups`

| CRUD | HTTP Verb | Endpoint | Description | Request Shape | Response Shape | Error Cases | User Stories |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Read | GET | `/api/groups` | List groups caller belongs to | — | `[{ id, name, created_at, closed_at, member_count }]` | — | Reuse saved group |
| Create | POST | `/api/groups` | Create group; caller added as first member | `{ name, member_ids? }` | `{ id, name, created_at, closed_at, members: [{ user_id, joined_at }] }` | 400 missing name | Create a group |
| Read | GET | `/api/groups/:group_id` | Group detail with members | — | `{ id, name, ..., members: [{ user_id, display_name, avatar_url, joined_at }] }` | 403 not a member; 404 | Group detail |
| Create | POST | `/api/groups/:group_id/members` | Add a member (invite) | `{ user_id }` _or_ `{ username }` | `{ group_id, user_id, joined_at }` | 403; 404; 409 already a member | Invite / join |
| Delete | DELETE | `/api/groups/:group_id/members/:user_id` | Remove member (self = leave) | — | `204` | 403; 404 | Leave group |
| Read | GET | `/api/groups/:group_id/messages?limit=&before=` | Paginated chat history (newest-first) | — | `[{ id, group_id, user_id, content, message_type, created_at }]` | 403 not a member | Group chat history |
| Create | POST | `/api/groups/:group_id/messages` | Persist a message | `{ content, message_type }` | `{ id, group_id, user_id, content, message_type, created_at }` | 400 empty/bad type; 403 | Group chat |
| Read | GET | `/api/groups/:group_id/sessions` | Past & active sessions in group | — | `[{ id, host_user_id, time_limit, avg_budget, created_at, closed_at }]` | 403 | Session history |
| Read | GET | `/api/groups/:group_id/events` | Finalized outings for group | — | `[{ id, date, address, restaurant_id, restaurant_name, group_id, group_name }]` | 403 | Remember where we ate |

### Sessions — `/api/sessions`

| CRUD | HTTP Verb | Endpoint | Description | Request Shape | Response Shape | Error Cases | User Stories |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Create | POST | `/api/sessions` | Start a session (optionally from a group) | `{ group_id?, time_limit, avg_budget }` | `{ id, host_user_id, group_id, time_limit, avg_budget, created_at, closed_at, members: [{ user_id, status }] }` | 400 invalid; 403 not in group; 404 | Start session from group |
| Read | GET | `/api/sessions/:session_id` | Session with members & readiness | — | `{ ...session, members: [{ user_id, display_name, status, joined_at }] }` | 403; 404 | Session view |
| Create | POST | `/api/sessions/:session_id/members` | Join session (status=false) | — | `{ session_id, user_id, status, joined_at }` | 404; 409 already joined; 400 closed | Join session |
| Read | GET | `/api/sessions/:session_id/members` | Members & readiness (poll) | — | `[{ user_id, display_name, status, joined_at }]` | 403 | See who's ready |
| Update | PATCH | `/api/sessions/:session_id/members/me` | Set caller's ready status | `{ status }` | `{ session_id, user_id, status, joined_at }` | 403; 404 | Signal I'm done |
| Create | POST | `/api/sessions/:session_id/qa` | Submit occasion/location/time/budget answers | `{ occasion?, location_mode?, location_lat?, location_lon?, radius_miles?, time_slot?, budget_min?, budget_max? }` | `{ ...qa }` | 400 invalid range; 403 | Share prefs, no form |
| Action | POST | `/api/sessions/:session_id/recommendations` | Run orchestrator, return ranked shortlist _(exists)_ | `{ force_partial? }` | `{ id, session_id, created_at, items: [{ restaurant_id, name, match_score, justification }] }` | 400 bad id; 409 members not confirmed; 502 upstream | Group shortlist + why |
| Read | GET | `/api/sessions/:session_id/recommendations` | Fetch latest stored recommendation | — | `{ id, session_id, created_at, items: [...] }` | 404 none yet | Re-view shortlist |
| Action | POST | `/api/sessions/:session_id/close` | Close session, create Event from choice | `{ restaurant_id, date, address }` | `{ session: {...}, event: { id, restaurant_id, restaurant_name, ... } }` | 400; 403 host only; 409 already closed | End & save result |
| Read | GET | `/api/sessions/:session_id/summary` | Compact recap of a closed session | — | `{ session_id, closed_at, chosen: { restaurant_id, name }, attendees, reason }` | 404; 409 not closed | Summary of decision |

### Restaurants — `/api/restaurants`

| CRUD | HTTP Verb | Endpoint | Description | Request Shape | Response Shape | Error Cases | User Stories |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Read | GET | `/api/restaurants?q=&cuisine=&dietary=&price_max=&limit=&offset=` | Browse/filter restaurants | — | `[{ id, name, description, cuisine_tags, dietary_tags, price_avg, address, lat, long, hours, avg_rating }]` | — | Restaurant discovery |
| Read | GET | `/api/restaurants/:restaurant_id` | Restaurant detail | — | `{ ...restaurant }` | 404 | Restaurant detail |
| Create | POST | `/api/restaurants/:restaurant_id/like` | Like (append to profile), idempotent | — | `{ liked_restaurant_ids: [...] }` | 404 | Feed long-term prefs |
| Delete | DELETE | `/api/restaurants/:restaurant_id/like` | Unlike | — | `{ liked_restaurant_ids: [...] }` | 404 | Feed long-term prefs |
| Create | POST | `/api/restaurants` | Create restaurant, then embed _(exists; owner/admin)_ | `{ name, description?, cuisine_tags?, dietary_tags?, price_avg?, address?, lat?, long?, hours?, avg_rating? }` | `{ ...restaurant }` | 400 missing name | Listing management |

### Events — `/api/events`

| CRUD | HTTP Verb | Endpoint | Description | Request Shape | Response Shape | Error Cases | User Stories |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Read | GET | `/api/events` | Past outings the caller attended | — | `[{ id, date, address, restaurant_id, restaurant_name, group_id, group_name }]` | — | Dining history |

**_Don't forget to set up your Issues, Milestones, and Project Board!_**

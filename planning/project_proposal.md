# Project Proposal

Pod Members: **Daniel Lam, Della Lee, Audrey Dequito, Miguel Cuevas**

## Problem Statement

- Problem Statement: Streamlining the process finding a restaurant between people (groups or 1:1) based on a questionnaire & constantly updated profiles.
- Target Audience: Foodies, General Consumers, Friends/Family, Strangers

## Description

A Group Based AI Food Planner:
A consumer-facing, "voice-first" web app where a group of friends each talk to their own AI agent about what they want to eat. A master AI orchestrator agent collects everyone's dietary preferences, budget, and location in real-time, finds restaurants that satisfy the whole group, lets each person browse and order from a shared menu, and connects everything into one group cart. This is all driven by a conversational, voice-enabled interface. Think Uber Eats but a group chat based on preference based on profile information

### Main Feature:

- Social network app with having friends connected
- Store personal rating to better search from the AI
- 2 core problems solved: Well known friends and for strangers who are meeting up (coffee chats, dates, etc)
- Stretch feature: Feed of recommended restaurants, user reviews, up and coming

### Workflow:

- Each person joins a session and talks to their own AI agent (voice or text)
- Shares preferences, restrictions, budget, etc
- Orchestrator Agent finds best-fit restaurants for the group
- Everyone browses & orders from a shared menu view (or best matched restaurant)
- Individual orders merge into one group cart
- Summary sent / order placed

## Expected Features List

Add a list of your groups's brainstormed features list

- Group chats with AI generated restaurant based on group's preferences saved within the given chat QnAs and user profiles
- Voice and text input for the AI agent
- Agent orchestrator that directs smaller agents for each given user in the group chat
- Personalized restaurant searching based on given user reviews and constraints (budget, distance, cuisines, etc)
- Automated food delivery system
- Save user reviews and past review restaurants as a long term preferences data
- Social network, similar to Imessage or Instagram
- Custom invite links to share and join new groups
- AI image model that extracts image data from picture of menus to onboard new data into the database
- User feed on the home page, similar to Uber Eats or user reviews on restaurant
- Real time data, up to date restaurant and menu items

## Related Work

- DoorDash
- UberEats
- GrubHub
- Imessage
- Instagram

Combine social platforms with food discovery, all in one app based on user profile preferences

## AI Feature API Endpoint Sketch

---

**Endpoint:** `POST /recommendations`

**Who calls it:** The frontend calls this when the master orchestrator agent is notified that all members in a group session have submitted their preferences — triggered when the last member confirms their input, or when the session host manually requests results.

**Request body:**
- `sessionId`: the unique ID of the active group session
- `occasion`: the social context mode — e.g. `"date"`, `"business_meal"`, `"birthday"`, `"coffee_chat"`, `"team_lunch"` — used to tune how the AI ranks and describes results
- `members`: array of member profile snapshots, each containing:
  - `userId`: each member's unique ID
  - `dietaryRestrictions`: hard constraints — e.g. `["vegan", "nut_allergy", "gluten_free"]`
  - `budgetRange`: per-person spend range — e.g. `{ min: 15, max: 40 }`
  - `preferenceHistory`: cuisine types the user has rated positively in past sessions
  - `dislikedCuisines`: cuisines to actively exclude from results
- `locationMode`: how location was provided — one of three values:
  - `"named"` — a user or the AI agent said a specific place or neighborhood (e.g. *"somewhere in the Mission"*); the frontend geocodes it and passes coordinates
  - `"realtime"` — a user said *"find something near me right now"*; the frontend requests GPS permission at that moment and passes live coordinates. Location is **never requested proactively** — only when this intent is detected in the conversation
  - `"unset"` — no location has been mentioned yet; the backend skips geographic filtering and sets `locationPrompt: true` in the response so the frontend can ask naturally
- `location`: `{ lat, lng, label }` — only present when `locationMode` is `"named"` or `"realtime"`. `null` when `"unset"`
- `radiusMiles`: how far to search — defaults to `2.0` when location is known, `null` when `"unset"`
- `groupSize`: total headcount including non-app members (e.g. a child, a grandparent)
- `timeSlot`: ISO 8601 datetime for filtering by open hours — e.g. `"2026-07-04T19:00:00"`. `null` means no time constraint yet

**What the backend does:**
1. Fetch all member profiles from the database and merge with the request
2. Determine search scope from `locationMode`: if `"named"` or `"realtime"`, query restaurants within `radiusMiles` of `location` filtered by `timeSlot`; if `"unset"`, skip geographic filtering entirely and set `locationPrompt: true` in the response. In both cases, exclude any restaurant that cannot accommodate every member's hard dietary restrictions
3. Construct a prompt for the AI model containing: the `occasion` type, the merged group preference profile, the candidate restaurant list with menu tags and descriptions, and a system instruction tuned to the occasion (e.g. for `"date"`, the AI weights ambiance and intimacy; for `"business_meal"`, it weights prestige and noise level)
4. Call the AI model with the prompt, requesting a ranked JSON list of up to 5 restaurants each with a justification
5. Log the session context and AI response to the audit table for admin observability
6. Return the ranked recommendations to the frontend

**Success response:**
- Status: `200`
- Body:
```json
{
  "sessionId": "sess_abc123",
  "recommendations": [
    {
      "restaurantId": "rest_001",
      "name": "Nopa",
      "rank": 1,
      "matchScore": 0.94,
      "justification": "Fully vegan-friendly menu, mid-range pricing, quiet enough for a business conversation, and highly rated for ambiance.",
      "tags": ["vegan-friendly", "quiet", "upscale-casual"],
      "distanceMiles": 0.8,
      "openNow": true
    }
  ],
  "occasion": "business_meal",
  "locationMode": "named",
  "locationPrompt": false,
  "generatedAt": "2026-07-04T17:23:01Z"
}
```

**Failure response:**
- Status: `500`
- Body: `{ "error": "AI recommendation unavailable" }`
- Fallback behavior: Frontend displays the top 3 results from a rule-based filter (dietary + budget + distance only, no AI ranking) with a banner: *"Showing basic matches — personalized ranking is temporarily unavailable."*

**Why this runs on the backend (not in the browser):**
The AI API key and the full restaurant and user database never leave the server — the browser only ever receives a ranked list of restaurant IDs. This also protects member privacy, since raw dietary and preference data from other group members is never exposed to the client.

---

**Endpoint:** `POST /ai/analyze`

**Who calls it:** The frontend calls this after every user turn in the personal agent chat. Including during both first-time profile setup and during an active group session when a member is describing what they want. It is the backbone of the voice-first experience.

**Request body:**
- `userId`: the logged-in user's ID
- `sessionId`: the active group session ID — or `null` if the user is updating their profile outside of a session
- `message`: the raw text of what the user said or typed — e.g. `"I'm not really feeling sushi tonight, maybe something warm like ramen or pho, and nothing too loud"`
- `messageSource`: `"voice"` or `"text"` — used to adjust AI parsing tolerance for informal or transcription-imperfect speech
- `conversationHistory`: the last N turns of the agent conversation as `[{ role, content }]` — gives the AI context so it doesn't re-ask things already established
- `currentProfile`: the user's existing stored preferences — so the AI knows what's already on file and only extracts what's new or changed

**What the backend does:**
1. Validate that the user belongs to the given session, or is in a valid profile-edit state if `sessionId` is null
2. Construct a structured extraction prompt instructing the AI to read the message in context of the conversation history and output a JSON object of any new or updated preference signals — cuisine inclinations, mood and vibe signals, noise tolerance, dietary flags, price sensitivity cues, occasion context clues, and **location intent** (whether the user named a place, expressed intent to search nearby right now, or said nothing location-related). The AI maps location to `locationMode: "named" | "realtime" | "unset"` and, if `"named"`, extracts the place name or neighborhood string for the frontend to geocode
3. Call the AI model requesting a strict JSON-only response
4. Diff the extracted signals against the user's `currentProfile` writing fields that are new or changed
5. Update the user's profile and session preference snapshot in the database
6. Construct and return an `agentReply,` a natural-language response the frontend plays back to the user via voice or text — confirming what was understood and asking a follow-up if key signals are still missing

**Success response:**
- Status: `200`
- Body:
```json
{
  "userId": "usr_xyz789",
  "sessionId": "sess_abc123",
  "extractedSignals": {
    "cuisineInclinations": ["ramen", "pho", "vietnamese"],
    "cuisineExclusions": ["sushi"],
    "vibeSignals": ["warm", "cozy"],
    "noiseTolerance": "low",
    "newDietaryFlags": [],
    "locationIntent": {
      "mode": "unset",
      "resolvedLabel": null
    }
  },
  "profileUpdated": true,
  "agentReply": "Got it — no sushi tonight, something warm. I'll keep an eye out for ramen and pho spots. Any budget in mind, or are we keeping it flexible?",
  "missingSignals": ["budgetRange"]
}
```

**Failure response:**
- Status: `500`
- Body: `{ "error": "AI analysis unavailable" }`
- Fallback behavior: Frontend saves the user's message as a plain note attached to the session without structured extraction. The orchestrator skips this member's preference data in the recommendation pass but does not block the session. A banner appears: *"We had trouble understanding your message — your input was saved as a note."*

**Why this runs on the backend (not in the browser):**
The AI model receives the user's full conversation history and profile — including allergy and dietary data — which must never be sent from the browser directly to a third-party API. Running on the backend also lets the server clean up voice transcription errors before the model sees them, and ensures all profile writes happen in an authenticated, controlled environment.

---

**Endpoint:** `GET /summaries/:id`

**Who calls it:** The frontend calls this when a user opens a past session from their history, or immediately after a group session ends and the results screen loads. The `:id` in the URL is the `sessionId`. The auth token is passed in the `Authorization` header.

**Request body:** None — this is a `GET` request. No body needed.

**What the backend does:**
1. Authenticate the request and verify the requesting user was a participant in session `:id`
2. Check the `session_summaries` cache table — if a summary was already generated when the session closed (async), return it immediately without calling the AI model
3. If no cached summary exists, fetch the raw session data: occasion type, aggregated group preferences, the final restaurant match and score, and each member's cart selections
4. Construct a prompt asking the AI to write a 2–3 sentence recap naming the occasion, the restaurant, and the key group signals that drove the match (e.g. everyone needed vegan options, budget was around $25 a head)
5. Cache the generated summary in `session_summaries` tagged to the `sessionId`
6. Return the summary to the frontend

**Success response:**
- Status: `200`
- Body:
```json
{
  "sessionId": "sess_abc123",
  "summary": "For Maya's birthday dinner, your group landed on Gracias Madre — a great fit for the three vegans in the group, with a relaxed vibe and a shared menu that kept everyone under $40. Dev's nut allergy was flagged and accommodated.",
  "occasion": "birthday",
  "restaurantChosen": {
    "restaurantId": "rest_007",
    "name": "Gracias Madre",
    "matchScore": 0.97
  },
  "groupSize": 6,
  "sessionClosedAt": "2026-07-04T21:14:00Z",
  "fromCache": true
}
```

**Failure response:**
- Status: `500`
- Body: `{ "error": "Summary unavailable" }`
- Fallback behavior: Frontend displays a minimal structured recap: restaurant name, occasion, group size, and date. No error is shown to the user; the structured fallback is designed to look intentional.

**Why this runs on the backend (not in the browser):**
Summaries are generated once and cached server-side so every group member who opens their session history sees the same consistent recap rather than a newly generated (and potentially different) one each time. The AI call happens asynchronously when the session closes, so no user ever waits for it when they open the recap screen.

## Open Questions

What questions do you still have? What topics do you need to research more for your project?

No questions. Researching topics on voice agents, AI orchestrator development, user preferences affect AI output, AI evaluations, custom links to be shared, real time data for menus and restaurants, creating randomized user feed.



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

Describe your app's data model using diagrams or tables

## Endpoints

List the API endpoints you will need to implement.

### AI Feature API Endpoint Sketch

**Endpoint:** [e.g., `POST /recommendations`, `POST /ai/analyze`, `GET /summaries/:id`]

**Who calls it:** [e.g., "The frontend calls this when a user opens their profile page"]

**Request body:**
- [field]: [what it contains — e.g., "userId: the logged-in user's ID"]
- [field]: [e.g., "context: a string containing the user's recent activity"]

**What the backend does:**
1. [e.g., "Fetch the user's saved items from the database"]
2. [e.g., "Construct a prompt from the user's context and the saved items"]
3. [e.g., "Call the OpenRouter API with the prompt"]
4. [e.g., "Return the model's response to the frontend"]

**Success response:**
- Status: 200
- Body: [e.g., `{ recommendation: "..." }` or `{ summary: "...", confidence: 0.9 }`]

**Failure response:**
- Status: 500
- Body: `{ "error": "AI recommendation unavailable" }`
- Fallback behavior: [e.g., "Frontend displays a generic message when this endpoint fails"]

**Why this runs on the backend (not in the browser):**
[1–2 sentences: your API key stays on the server; the frontend never sees it. This is the secure version of what you did in Flixster, where the key was in the browser — here it's protected.]

**_Don't forget to set up your Issues, Milestones, and Project Board!_**

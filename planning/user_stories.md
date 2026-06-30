# Project Proposal

Pod Members: **Daniel Lam, Della Lee, Audrey Dequito, Miguel Cuevas**

## Problem Statement

- Problem Statement: Streamlining the process finding a restaurant between people (groups or 1:1) based on a questionnaire & constantly updated profiles.
- Target Audience: Foodies, General Consumers, Friends/Family, Strangers

## 1. User Roles

- **"member"**: a user who joins or creates a group session to find a restaurant that works for everyone
- **"restaurant_owner"**: a user who manages their restaurant's listing, menu photos, and descriptions on the platform (stretch feature)
- **"admin"**: an internal operator who approves restaurant listings, moderates content, and monitors the AI pipeline

## 2. User Personas

### Role: Member

**Maya**, 26, grad student in San Francisco. The default planner in her friend group — always the one starting the chat and researching options while everyone else says "whatever." Phone-first, uses the app weekly with groups of 4–6 that have mixed dietary needs (vegan, nut allergy, varying budgets). Wants the app to take the planning burden off her without feeling like a form.

**Dev**, 31, software engineer in Austin. Never organizes — just gets added to sessions and wants to set his preferences once and never repeat them. Has a tree nut allergy he's tired of re-entering everywhere. Desktop at work, phone after hours, skeptical of voice (often in loud or open spaces), prefers typing. Uses the app once or twice a month, whenever friends pull him in.

**Sofia**, 42, marketing manager in Chicago. Organizes team lunches and client dinners weekly for 10–15 colleagues on a company budget. Desktop user who needs speed — no time for a slow AI conversation per person. Cares about dietary variety (vegan, halal), parking, and clean itemized receipts for expensing. Would become a power user if it cuts the back-and-forth.

**Tomás**, 22, college student in LA. Plans spontaneously — usually a group chat at 10:30pm figuring out what's open. Phone-only, wants zero friction (no signup if possible), price is his first filter (~$15–20/head), and speed is second — answer in under two minutes. Most likely to drop off if onboarding is slow or voice fails in a loud place.

### Role: Restaurant Owner

**Anika**, 38, owns a family-run South Indian restaurant in San Francisco. Runs everything herself, no tech staff — comfortable with Instagram-level tools but not a complex dashboard. Wants her mostly-vegan menu accurately labeled so customers stop calling confused. Uploads photos from her phone; wants it as simple as posting to Instagram. Worries that menu edits don't update fast enough for customers.

**Carlos**, 45, co-owns a 3-location taqueria chain in Dallas–Fort Worth. Less concerned with content, more with operations — needs advance notice when a large group order is coming so his kitchen isn't blindsided. Wants to manage all locations from one login and push menu updates everywhere at once. Has a part-time social media person who handles day-to-day listing updates.

### Role: Admin

**Rachel**, 29, remote content/trust ops contractor. Reviews new restaurant submissions, checks photos aren't stock images, flags outdated listings. Non-technical but detail-oriented, works through a daily queue. Needs a prioritized moderation dashboard — new submissions, flagged content, and stale listings surfaced first. Spends several hours a day in the admin panel.

**James**, 35, technical super-admin and full-stack engineer. Monitors the AI pipeline, manages role permissions, and debugs orchestrator issues — not content moderation, that's Rachel's job. Needs audit logs and session traces to catch AI hallucinations or recommendations that ignored a hard dietary restriction. Gets paged when something breaks; wants full input/output visibility per session without digging through raw tables.

## User Stories

### Member

**Onboarding & Profile**
- As a member, I want to set my dietary restrictions and food preferences once, so that I don't have to repeat them every time I join a session.
- As a member, I want to update my profile at any time, so that my preferences stay accurate as they change.
- As a member, I want to join a session without creating an account, so that I can participate even if I'm new to the app.

**Groups**
- As a member, I want to create a group with my regular friends or coworkers, so that I don't have to re-invite the same people every time we want to eat together.
- As a member, I want to chat with my group outside of a food-planning session, so that the app feels like a normal group chat, not just a tool I open occasionally.
- As a member, I want to start a session from within an existing group, so that everyone's saved preferences are used automatically.
- As a member, I want to see the history of past sessions in a group, so that I can remember where we've already eaten.

**Sessions**
- As a member, I want to talk to my personal AI agent by voice or text, so that I can share what I'm in the mood for without filling out a form.
- As a member, I want to see when other members of my session have finished sharing their preferences, so that I know when we're ready to see recommendations.
- As a member, I want to see a shortlist of restaurants that work for the whole group, so that I don't have to manually check everyone's constraints myself.
- As a member, I want to understand why a restaurant was recommended, so that I can trust the suggestion instead of guessing.
- As a member, I want to browse a restaurant's menu within the session, so that I can decide what I'd personally order before we commit.
- As a member, I want to add items to a shared group cart, so that our whole order is organized in one place.
- As a member, I want the session to remember my location preference only if I gave one, so that the app doesn't ask for my location when I haven't asked for nearby results.
- As a member, I want to end a session once we've picked a restaurant, so that the result is saved and the group chat returns to normal.
- As a member, I want to see a short summary of how a past session was decided, so that I can recall the outcome without re-reading the whole conversation.

### Restaurant Owner

**Listing Management**
- As a restaurant owner, I want to create a profile for my restaurant, so that groups can discover and consider it.
- As a restaurant owner, I want to upload photos of my menu items, so that customers see an accurate representation of my food.
- As a restaurant owner, I want to edit my menu descriptions and pricing, so that the information customers see is always current.
- As a restaurant owner, I want to tag menu items with dietary labels, so that I'm recommended to groups whose needs I can actually meet.
- As a restaurant owner, I want to set my hours and availability, so that I'm not recommended to groups when I'm closed.

**Operations**
- As a restaurant owner, I want to see incoming group orders before they arrive, so that my kitchen can prepare for larger parties.
- As a restaurant owner managing multiple locations, I want to update my menu across all locations at once, so that I don't have to repeat the same edit multiple times.

### Admin

**Content Moderation**
- As an admin, I want to review new restaurant listings before they go live, so that only accurate, legitimate businesses appear on the platform.
- As an admin, I want to see flagged menu photos or descriptions in a prioritized queue, so that I can address the most urgent issues first.
- As an admin, I want to approve or reject a restaurant submission, so that I can keep the platform's content trustworthy.

**Platform Oversight**
- As an admin, I want to view logs of what the AI recommended and why, so that I can catch cases where it ignored a dietary restriction or hallucinated details.
- As an admin, I want to manage user roles and permissions, so that I can grant or revoke restaurant owner and admin access as needed.
- As an admin, I want to suspend a user or restaurant account, so that I can respond to abuse or fraud on the platform.

### Backlog

*Stories considered but not actively being built. Revisit as priorities shift.*

- As a member, I want to mark a session as a special occasion (e.g. birthday), so that the AI can prioritize ambiance or surprise-friendly venues over efficiency.
- As a member, I want to set a budget for someone else in my group (e.g. a guest who isn't on the app), so that they're still factored into the recommendation.
- As a member, I want to rate a restaurant after my group has eaten there, so that future recommendations for my group improve over time.
- As a restaurant owner, I want to see aggregated insights about which group preferences are matching with my restaurant, so that I can adjust my menu or marketing.
- As an admin, I want to run the same set of test inputs through the AI pipeline and compare outputs over time, so that I can catch regressions in recommendation quality.
- As a member, I want to set a time limit on a session, so that the group is nudged to make a decision instead of stalling indefinitely.

## Previous User Stories

1. As a Group Member, I want to fill out my preference profile once (dietary restrictions, food preferences, budget) so that I don't have to re-enter it every time.
2. As a Group Member, I want to edit my preference profile anytime so that my recommendations stay accurate as my tastes change.
3. As a Group Member, I want to create a group so that I can invite others to find a restaurant together.
4. As a Group Member, I want to join a group via an invite link so that I can participate even with people I've just met.
5. As a Group Member, I want to enter the time, location, budget for an occasion so that the AI suggests restaurants that are open and nearby.
6. As a Group Member, I want to talk to my own AI agent by voice or text about what I'm in the mood for so that I can express preferences naturally without filling out a form each time.
7. As a Group Member, I want to react to or vote on a suggestion so that the group can quickly agree on a final choice.
8. As a Group Member, I want the AI to suggest an alternative if the group rejects the first option so that we aren't stuck.
9 As a Group Member, I want to reuse a saved group (e.g. family) so that recurring outings take just a few taps.
10. As a Group Member, I want to browse and order from a shared menu so that everyone can pick their own items in one place.
11. As a Group Member, I want to leave a review/rating after a meal so that it feeds my long-term preferences and improves future recommendations.


## Wireframe (Bonus)

Insert link or image to your group's wireframe.

# Project Proposal

Pod Members: **Daniel Lam, Della Lee, Audrey Dequito, Miguel Cuevas**

## Problem Statement

- Problem Statement: Streamlining the process finding a restaurant between people (groups or 1:1) based on a questionnaire & constantly updated profiles.
- Target Audience: Foodies, General Consumers, Friends/Family, Strangers

## 1. User Roles

- **"member"**: a user who joins or creates a group session to find a restaurant that works for everyone
- **"admin"**: an internal operator who approves restaurant listings, moderates content, and monitors the AI pipeline
- **"restaurant_owner (stretch feature)"**: a user who manages their restaurant's listing, menu photos, and descriptions on the platform

## 2. User Personas

### Role: Member

**Maya** is a 26-year-old grad student in San Francisco who is the default planner in her friend group, always the one starting the chat and researching options while everyone else says "whatever." She's phone-first and uses the app weekly with groups of 4–6 friends who have mixed dietary needs, including a vegan and a nut allergy. Maya wants the app to take the planning burden off her without making the process feel like filling out a form.

**Dev** is a 31-year-old software engineer in Austin who never organizes plans himself and just gets added to sessions by his friends. He has a tree nut allergy he's tired of re-entering every time, so he wants to set his preferences once and never repeat them. He's desktop-first at work but phone-only after hours, is skeptical of voice since he's often in loud or open spaces, and uses the app once or twice a month whenever friends pull him in.

**Sofia** is a 42-year-old marketing manager in Chicago who organizes team lunches and client dinners on a near-weekly basis for groups of 10 to 15 colleagues on a company budget. She's a desktop user who needs speed, since she doesn't have time for a slow AI conversation per person, and she cares about dietary variety, parking, and clean itemized receipts for expensing afterward. Sofia would become a power user if the app cuts down the usual back-and-forth.

**Tomás** is a 22-year-old college student in Los Angeles who plans spontaneously, usually starting a group chat around 10:30pm to figure out what's open nearby. He's phone-only and wants zero friction, ideally without having to sign up at all, and price is his first filter at around $15 to $20 a head, with speed as the second priority since he wants an answer in under two minutes. Tomás is the persona most likely to drop off if onboarding is slow or if voice input fails in a loud place.

### Role: Admin

**Rachel** is a 29-year-old remote content and trust operations contractor who reviews new restaurant submissions, checks that photos aren't stock images, and flags listings with outdated information. She's non-technical but extremely detail-oriented and works through a queue of tasks every day, so she needs a prioritized moderation dashboard that surfaces new submissions, flagged content, and stale listings first. Rachel spends several hours a day working inside the admin panel.

**James** is a 35-year-old technical super-admin and full-stack engineer who monitors the AI pipeline, manages role permissions, and debugs issues with the orchestrator rather than handling content moderation, which is Rachel's responsibility. He needs audit logs and session traces so he can catch AI hallucinations or recommendations that ignored a hard dietary restriction, and he's the person who gets paged when something breaks. James wants full visibility into a session's AI inputs and outputs without having to dig through raw database tables.

### Role: Restaurant Owner (stretch feature)

**Anika** is a 38-year-old owner of a family-run South Indian restaurant in San Francisco who runs everything herself without any tech staff to help. She's comfortable with simple tools like Instagram but not with a complex dashboard, and she wants her mostly-vegan menu accurately labeled so customers stop calling in confused about what's actually available. Anika uploads photos from her phone and wants the process to feel as simple as posting to social media, and her biggest worry is that menu edits don't show up fast enough for customers.

**Carlos** is a 45-year-old co-owner of a three-location taqueria chain in the Dallas–Fort Worth area who cares less about content and more about operations. He needs advance notice when a large group order is coming in so his kitchen isn't blindsided, and he wants to manage all three locations from a single login and push menu updates to every location at once. Carlos has a part-time social media person who handles most of the day-to-day listing updates on his behalf.

## User Stories

### Member

**Onboarding & Profile**
- As a member, I want to set my dietary restrictions and food preferences once, so that I don't have to repeat them every time I join a session.
- As a member, I want to update my profile at any time, so that my preferences stay accurate as they change.

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
- As a member, I want to add items to a shared group event, so that our whole order is organized in one place.
- As a member, I want the session to remember my location preference only if I gave one, so that the app doesn't ask for my location when I haven't asked for nearby results.
- As a member, I want to end a session once we've picked a restaurant, so that the result is saved and the group chat returns to normal.
- As a member, I want to see a short summary of how a past session was decided, so that I can recall the outcome without re-reading the whole conversation.

### Admin

**Content Moderation**
- As an admin, I want to review new restaurant listings before they go live, so that only accurate, legitimate businesses appear on the platform.
- As an admin, I want to see flagged menu photos or descriptions in a prioritized queue, so that I can address the most urgent issues first.
- As an admin, I want to approve or reject a restaurant submission, so that I can keep the platform's content trustworthy.

**Platform Oversight**
- As an admin, I want to view logs of what the AI recommended and why, so that I can catch cases where it ignored a dietary restriction or hallucinated details.
- As an admin, I want to manage user roles and permissions, so that I can grant or revoke restaurant owner and admin access as needed.
- As an admin, I want to suspend a user or restaurant account, so that I can respond to abuse or fraud on the platform.

### Restaurant Owner (stretch feature)

**Listing Management**
- As a restaurant owner, I want to create a profile for my restaurant, so that groups can discover and consider it.
- As a restaurant owner, I want to upload photos of my menu items, so that customers see an accurate representation of my food.
- As a restaurant owner, I want to edit my menu descriptions and pricing, so that the information customers see is always current.
- As a restaurant owner, I want to tag menu items with dietary labels, so that I'm recommended to groups whose needs I can actually meet.
- As a restaurant owner, I want to set my hours and availability, so that I'm not recommended to groups when I'm closed.

**Operations**
- As a restaurant owner, I want to see incoming group orders before they arrive, so that my kitchen can prepare for larger parties.
- As a restaurant owner managing multiple locations, I want to update my menu across all locations at once, so that I don't have to repeat the same edit multiple times.

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

[Wireframe](https://www.figma.com/proto/mEDkotB3eUYXYc1E6arQ7t/GrubGroup-Wireframes--Separated-?node-id=8-2258&p=f&t=hpotyvnyr1hUF0H6-0&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1&starting-point-node-id=8%3A2258)

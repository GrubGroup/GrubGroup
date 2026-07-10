# Reflection #1

Pod Members: **Della Lee, Daniel Lam, Audrey Dequito, Miguel Cuevas**

## Reflection Questions

* Name at least one successful thing this week.

This week we implemented the basic frontend (wireframe traced with shared components); real-time group chat over WebSocket (isolated rooms, typing indicator, session-start sync); a scaffolded-and-running AI service with a LangGraph group-recommendation pipeline, pgvector embeddings, and a SQLModel read-side data layer; the recommendation endpoint proxied gateway→ai_service; PostgreSQL schema via Prisma with 67 seeded restaurants

* What were some challenges you and/or your group faced this week?

A core challenge was dependency ordering between layers. The frontend needs data the backend isn't ready to serve yet. We solved it with a mock-data swap boundary (VITE_USE_MOCK): the frontend runs on typed mock fixtures and flips to the live gateway with one env flag, so front-end and back-end work happened in parallel instead of sequentially. The main remaining dependency was auth and the shared DB schema, which several features build on.

* Did you finish all of your tasks in your sprint plan for this week? If you did not finish all of the planned tasks, how would you prioritize the remaining tasks on your list?  (i.e over planned, did not know how to implement certain features, miscommunication from the team, had to pivot from original plans, etc.)

We finished most of the tasks we were planning to get done this week; we prioritized getting the scaffolding of the project finished. Our main strategy was to build basic functionality against mock data first, before connecting Express and the database, so that each feature was demoable early without waiting on the backend. For example, the chat function uses a mock user, since the real user profile data isn't fully wired up yet.


* Did the resources provided to you help prepare you in planning and executing your capstone project sprint this week? Be specific, what resources did you find particularly helpful or which tasks did you need more support on?

We learned how the system connects end to end. Database -> backend -> frontend, and how a single request flows through all three layers. We also learned how user stories shape the wireframe and how the wireframes shape the frontend: staring from what the user needs, to the UI design, to the actual data flow.

* Which features and user stories would you consider “at risk”? How will you change your plan if those items remain “at risk”?

Persistent chat and session data: the live chat and session sync works, but they're currently ephemeral or no database writes, so messages and sessions resets on refresh. Persisting them isn't done yet and will be done with the connection with the database. 


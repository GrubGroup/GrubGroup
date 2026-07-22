import { create } from 'zustand'
import type { Recommendation, Session, SessionMember, SessionPhase } from '@/types'
import { fetchRecommendation, fetchSession, generateRecommendation } from '@/api/sessionApi'
import { useAuthStore } from '@/stores/authStore'

// Module-level guard so the timer-expiry generation fires at most once even if
// both the group-chat card timer and the agent-chat top-bar timer were to expire.
let expiryGenerating = false

// The signed-in user's name fields, so locally-built roster rows for the current
// user carry a real name (the gateway's create response doesn't include one, and
// join/progress rows would otherwise be nameless → "User N"/"U1" avatars).
// Read lazily via getState() — authStore does not import sessionStore, so there's
// no cycle. Returns undefined name fields when signed out (mock defaults apply).
function selfNameFields(userId: number): Pick<SessionMember, 'display_name' | 'username'> {
  const user = useAuthStore.getState().user
  if (!user || user.id !== userId) return {}
  return { display_name: user.display_name ?? null, username: user.username ?? null }
}

interface SessionState {
  session: Session | null
  // The live session id the flow is operating on (host-created or joined). Drives
  // every session REST call (analyze / ready / generate / close). Null until a
  // session is created or loaded.
  activeSessionId: number | null
  // ISO time the countdown started from — the session:start broadcast `at` (live)
  // or the session's created_at. The timer counts time_limit minutes from here.
  startedAt: string | null
  members: SessionMember[]
  // Server-authoritative member count from the session:member_done broadcast.
  // The progress denominator uses max(this, members.length) so a broadcast that
  // arrives before (or without) a full roster load still shows the right total
  // (e.g. 1/6, not 1/1). 0 = unknown → fall back to members.length.
  serverTotal: number
  recommendation: Recommendation | null
  // Results-fetch UI state so the results screen can tell loading / empty / error
  // apart instead of a single permanent "Loading picks…". `recommendationError`
  // is set when the read-back fails on a session that should already have results.
  recommendationLoading: boolean
  recommendationError: boolean
  phase: SessionPhase
  votes: Record<number, number[]> // restaurantId -> userIds who voted
  chosenRestaurantId: number | null
  currentUserId: number

  load: (sessionId: number, currentUserId: number) => Promise<void>
  // Merge the gateway's name-carrying roster into `members` WITHOUT resetting
  // phase/startedAt (unlike load). Used to give the host real member names right
  // after they create a session (their local rows are otherwise nameless).
  hydrateMembers: (sessionId: number) => Promise<void>
  // Adopt a session object directly (e.g. the one the host just created via the
  // modal), without a round-trip. Seeds activeSessionId + startedAt.
  setSession: (session: Session, currentUserId?: number) => void
  // Record when the countdown clock started (from the session:start broadcast).
  setStartedAt: (at: string) => void
  setPhase: (phase: SessionPhase) => void
  join: () => void
  setMemberDone: (userId: number) => void
  // Apply a live session:member_done broadcast: flip that member's status (adding
  // them if the roster hasn't loaded them yet) so every client's progress bar and
  // roster reconcile from the server echo — not an optimistic local flip.
  applyProgress: (doneCount: number, total: number, userId: number, status: boolean) => void
  // Adopt a recommendation delivered live over the socket (session:picks), so the
  // "Results" affordance appears without a fetch. Stores the recommendation only —
  // it deliberately does NOT set phase:'picks' (that implies the user is VIEWING
  // results); navigation to the results screen stays user-driven.
  receivePicks: (payload: {
    recommendationId: number
    sessionId: number
    items: Recommendation['items']
  }) => void
  loadRecommendation: () => Promise<void>
  // Timer-expiry fallback: the HOST client alone generates results (force_partial)
  // if the countdown runs out before everyone finishes. No-op for non-hosts or
  // when results already exist. Guarded against concurrent/repeat calls.
  triggerExpiryGeneration: () => Promise<void>
  castVote: (restaurantId: number, userId: number) => void
  chooseRestaurant: (restaurantId: number) => void
  close: () => void

  // selectors
  doneCount: () => number
  progressTotal: () => number
  isHost: () => boolean
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  activeSessionId: null,
  startedAt: null,
  members: [],
  serverTotal: 0,
  recommendation: null,
  recommendationLoading: false,
  recommendationError: false,
  phase: 'joining',
  votes: {},
  chosenRestaurantId: null,
  currentUserId: 1,

  load: async (sessionId, currentUserId) => {
    const { session, members } = await fetchSession(sessionId)
    set({
      session,
      members,
      serverTotal: members.length,
      currentUserId,
      activeSessionId: session.id,
      startedAt: session.created_at ?? null,
      phase: 'joining',
    })
  },

  hydrateMembers: async (sessionId) => {
    const { members: fetched } = await fetchSession(sessionId)
    set((s) => {
      // Merge fetched name/status rows over the local roster, preserving any
      // local status flip that's newer than the fetch (a member who finished
      // between create and hydrate). Fetched rows are the source of names.
      const byId = new Map(s.members.map((m) => [m.user_id, m]))
      const merged = fetched.map((f) => {
        const local = byId.get(f.user_id)
        return { ...f, status: local?.status || f.status }
      })
      // Keep any local-only rows the fetch doesn't know about yet.
      for (const local of s.members) {
        if (!merged.some((m) => m.user_id === local.user_id)) merged.push(local)
      }
      return { members: merged, serverTotal: Math.max(s.serverTotal, merged.length) }
    })
  },

  setSession: (session, currentUserId) => {
    // A brand-new session clears the once-per-session expiry-generation latch, so
    // the new session's timer fallback can fire (the prior session may have set it).
    expiryGenerating = false
    set((s) => {
      // Adopting a session the current user just created is a FRESH START — even
      // if a prior session ran in this group. Seed the roster with ONLY the host
      // (their real name), so hydrateMembers can merge in the rest; do NOT carry
      // over the previous session's roster/total. Clear the previous session's
      // results + voting state so the new session's card shows 'in progress' (not
      // an instant 'complete' from a stale recommendation) and Results is empty
      // until this session generates its own. Guards the "start another session
      // after one completes" flow (the button re-enables once complete).
      const uid = currentUserId ?? s.currentUserId
      const members = [
        {
          session_id: session.id,
          user_id: uid,
          status: false,
          joined_at: new Date().toISOString(),
          ...selfNameFields(uid),
        },
      ]
      return {
        session,
        members,
        serverTotal: members.length,
        activeSessionId: session.id,
        startedAt: session.created_at ?? new Date().toISOString(),
        currentUserId: uid,
        // Clear prior-session results/voting so nothing leaks into the new one.
        recommendation: null,
        recommendationLoading: false,
        recommendationError: false,
        votes: {},
        chosenRestaurantId: null,
        phase: 'joining',
      }
    })
  },

  setStartedAt: (at) => set({ startedAt: at }),

  setPhase: (phase) => set({ phase }),

  join: () => {
    const { members, currentUserId } = get()
    const already = members.some((m) => m.user_id === currentUserId)
    const next = already
      ? members
      : [
          ...members,
          {
            session_id: get().session?.id ?? 0,
            user_id: currentUserId,
            status: false,
            joined_at: new Date().toISOString(),
            ...selfNameFields(currentUserId),
          },
        ]
    set({ members: next, phase: 'waiting' })
  },

  setMemberDone: (userId) => {
    set((s) => ({
      members: s.members.map((m) => (m.user_id === userId ? { ...m, status: true } : m)),
    }))
    // If it was the current user, advance their UI phase to "done".
    if (userId === get().currentUserId) set({ phase: 'done' })
  },

  applyProgress: (_doneCount, total, userId, status) => {
    set((s) => {
      const known = s.members.some((m) => m.user_id === userId)
      const members = known
        ? s.members.map((m) =>
            m.user_id === userId
              ? // Backfill the current user's name if this row was created bare
                // (e.g. by an earlier progress echo) so its avatar isn't "User N".
                { ...m, status, ...(m.display_name || m.username ? {} : selfNameFields(userId)) }
              : m,
          )
        : [
            ...s.members,
            {
              session_id: s.session?.id ?? s.activeSessionId ?? 0,
              user_id: userId,
              status,
              joined_at: new Date().toISOString(),
              ...selfNameFields(userId),
            },
          ]
      // Trust the server's authoritative total so the denominator is right even
      // if this client's roster load hasn't landed (or was missed on reload).
      return { members, serverTotal: Math.max(total, members.length, s.serverTotal) }
    })
    // Reflect the current user's own completion in their local UI phase.
    if (userId === get().currentUserId && status) set({ phase: 'done' })
  },

  receivePicks: ({ recommendationId, sessionId, items }) =>
    set({
      recommendation: {
        id: recommendationId,
        session_id: sessionId,
        created_at: new Date().toISOString(),
        items,
      },
    }),

  loadRecommendation: async () => {
    const id = get().activeSessionId ?? get().session?.id
    if (id == null) return
    set({ recommendationLoading: true, recommendationError: false })

    // Results often don't exist the instant the user opens the picks screen — the
    // group orchestrator can still be running (the read-back 404s), or we're
    // waiting on the last member to finish. Rather than flashing an alarming
    // "Couldn't load results" error, keep the loading circle up and POLL for a
    // while. A live session:picks delivery (receivePicks) can populate
    // `recommendation` meanwhile, which ends the poll early. Only after we've
    // exhausted our patience do we surface a retryable error.
    const MAX_ATTEMPTS = 20
    const RETRY_MS = 3000
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // A socket delivery may already have filled the recommendation — stop.
      if (get().recommendation) {
        set({ recommendationLoading: false, recommendationError: false })
        return
      }
      try {
        const recommendation = await fetchRecommendation(id)
        set({ recommendation, phase: 'picks', recommendationLoading: false, recommendationError: false })
        return
      } catch {
        // Not ready yet (usually a 404 while generation runs). Wait, then retry —
        // keeping the loading state up so the UI never shows an error mid-flight.
        if (attempt < MAX_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_MS))
        }
      }
    }
    // Gave up after repeated attempts — surface a retryable error state (the user
    // can hit Retry, and a later session:picks socket delivery still recovers it).
    set({ recommendationLoading: false, recommendationError: true })
  },

  triggerExpiryGeneration: async () => {
    const { activeSessionId, recommendation } = get()
    // Only the host generates; skip if results already exist or none in progress.
    if (activeSessionId == null || recommendation != null || !get().isHost()) return
    if (expiryGenerating) return
    expiryGenerating = true
    try {
      await generateRecommendation(activeSessionId, { forcePartial: true })
      // The gateway broadcasts session:picks, so results arrive via the socket.
    } catch {
      // Generation failure (e.g. 409 not-ready) is surfaced elsewhere; allow a
      // later retry rather than latching the guard.
      expiryGenerating = false
    }
  },

  castVote: (restaurantId, userId) => {
    set((s) => {
      const next: Record<number, number[]> = {}
      // A user has at most one vote — remove them from all lists first.
      for (const [rid, voters] of Object.entries(s.votes)) {
        next[Number(rid)] = voters.filter((u) => u !== userId)
      }
      const current = next[restaurantId] ?? []
      // Toggle: clicking your current pick removes the vote.
      const already = (s.votes[restaurantId] ?? []).includes(userId)
      next[restaurantId] = already ? current : [...current, userId]
      return { votes: next }
    })
  },

  chooseRestaurant: (restaurantId) => set({ chosenRestaurantId: restaurantId }),

  close: () =>
    set((s) => ({
      phase: 'complete',
      session: s.session ? { ...s.session, closed_at: new Date().toISOString() } : null,
    })),

  doneCount: () => get().members.filter((m) => m.status).length,

  progressTotal: () => {
    const { serverTotal, members } = get()
    return Math.max(serverTotal, members.length)
  },

  isHost: () => {
    const { session, currentUserId } = get()
    return session != null && session.host_user_id === currentUserId
  },
}))

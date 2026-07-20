import { create } from 'zustand'
import type { Recommendation, Session, SessionMember, SessionPhase } from '@/types'
import { fetchRecommendation, fetchSession, generateRecommendation } from '@/api/sessionApi'
import { MOCK_RECOMMENDATION } from '@/api/mock/sessionMock'
import { USE_MOCK } from '@/lib/env'
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
  // MOCK-ONLY demo helper: flip every remaining member to done and adopt the mock
  // recommendation, standing in for the gateway's server-side auto-complete (which
  // isn't reachable offline, where the socket is disabled).
  simulateAutoComplete: () => void
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

  setSession: (session, currentUserId) =>
    set((s) => {
      // Seed the host (the current user, who just created the session) into the
      // roster with their real name, so the roster is never empty/nameless right
      // after create — hydrateMembers then merges in the rest of the group.
      const uid = currentUserId ?? s.currentUserId
      const hasSelf = s.members.some((m) => m.user_id === uid)
      const members = hasSelf
        ? s.members
        : [
            ...s.members,
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
        serverTotal: Math.max(s.serverTotal, members.length),
        activeSessionId: session.id,
        startedAt: session.created_at ?? new Date().toISOString(),
        currentUserId: uid,
      }
    }),

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
    try {
      const recommendation = await fetchRecommendation(id)
      set({ recommendation, phase: 'picks', recommendationLoading: false })
    } catch {
      // The read-back failed — most often a 404 because generation hasn't landed
      // yet (or the session timed out with nothing to generate). Surface it as a
      // retryable error state rather than throwing (which left the page stuck on a
      // permanent "Loading picks…" with no recovery). A later session:picks socket
      // delivery still populates `recommendation` via receivePicks.
      set({ recommendationLoading: false, recommendationError: true })
    }
  },

  triggerExpiryGeneration: async () => {
    const { activeSessionId, recommendation } = get()
    // Only the host generates; skip if results already exist or none in progress.
    if (activeSessionId == null || recommendation != null || !get().isHost()) return
    if (expiryGenerating) return
    expiryGenerating = true
    try {
      const rec = await generateRecommendation(activeSessionId, { forcePartial: true })
      // Live: the gateway broadcasts session:picks, so results arrive via the
      // socket. Offline (mock, socket null): adopt the rec so Results appears.
      if (USE_MOCK) {
        get().receivePicks({
          recommendationId: rec.id,
          sessionId: activeSessionId,
          items: rec.items,
        })
      }
    } catch {
      // Generation failure (e.g. 409 not-ready) is surfaced elsewhere; allow a
      // later retry rather than latching the guard.
      expiryGenerating = false
    }
  },

  simulateAutoComplete: () => {
    const { session, activeSessionId, recommendation } = get()
    if (recommendation != null) return // already have results — don't regenerate
    set((s) => ({
      members: s.members.map((m) => ({ ...m, status: true })),
      recommendation: {
        ...structuredClone(MOCK_RECOMMENDATION),
        session_id: activeSessionId ?? session?.id ?? MOCK_RECOMMENDATION.session_id,
      },
    }))
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

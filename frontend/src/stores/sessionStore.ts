import { create } from 'zustand'
import type { Recommendation, Session, SessionMember, SessionPhase } from '@/types'
import { fetchRecommendation, fetchSession } from '@/api/sessionApi'
import { MOCK_RECOMMENDATION } from '@/api/mock/sessionMock'

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
  phase: SessionPhase
  votes: Record<number, number[]> // restaurantId -> userIds who voted
  chosenRestaurantId: number | null
  currentUserId: number

  load: (sessionId: number, currentUserId: number) => Promise<void>
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

  setSession: (session, currentUserId) =>
    set((s) => ({
      session,
      activeSessionId: session.id,
      startedAt: session.created_at ?? new Date().toISOString(),
      currentUserId: currentUserId ?? s.currentUserId,
    })),

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
        ? s.members.map((m) => (m.user_id === userId ? { ...m, status } : m))
        : [
            ...s.members,
            {
              session_id: s.session?.id ?? s.activeSessionId ?? 0,
              user_id: userId,
              status,
              joined_at: new Date().toISOString(),
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
    const recommendation = await fetchRecommendation(id)
    set({ recommendation, phase: 'picks' })
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

import { create } from 'zustand'
import type { Recommendation, Session, SessionMember, SessionPhase } from '@/types'
import { fetchRecommendation, fetchSession } from '@/api/session.api'

interface SessionState {
  session: Session | null
  members: SessionMember[]
  recommendation: Recommendation | null
  phase: SessionPhase
  votes: Record<number, number[]> // restaurantId -> userIds who voted
  chosenRestaurantId: number | null
  currentUserId: number

  load: (sessionId: number, currentUserId: number) => Promise<void>
  setPhase: (phase: SessionPhase) => void
  join: () => void
  setMemberDone: (userId: number) => void
  loadRecommendation: () => Promise<void>
  castVote: (restaurantId: number, userId: number) => void
  chooseRestaurant: (restaurantId: number) => void
  close: () => void

  // selectors
  doneCount: () => number
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  members: [],
  recommendation: null,
  phase: 'joining',
  votes: {},
  chosenRestaurantId: null,
  currentUserId: 1,

  load: async (sessionId, currentUserId) => {
    const { session, members } = await fetchSession(sessionId)
    set({ session, members, currentUserId, phase: 'joining' })
  },

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

  loadRecommendation: async () => {
    const s = get().session
    if (!s) return
    const recommendation = await fetchRecommendation(s.id)
    set({ recommendation, phase: 'picks' })
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
}))

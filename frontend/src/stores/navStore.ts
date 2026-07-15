import { create } from 'zustand'

// Screen switcher (no router) — mirrors the wireframe journey. See the
// frontend-user-journey memory for the transition map. Two parallel contexts:
// the group-chat view and the agent-chat view; a session shows as a card inside
// the group chat.
export type Screen =
  // Auth
  | 'sign-in'
  | 'sign-up'
  // Onboarding (profile/preferences)
  | 'onboarding-1'
  | 'onboarding-2'
  | 'onboarding-3'
  // Group-chat context
  | 'empty-groups'
  | 'group-chat' // Group Food Planning App (session card: not joined)
  | 'session-continue' // group-chat card, session in progress (after back)
  | 'session-waiting' // group-chat card, user done, waiting for others
  | 'scrolled-past' // floating session card when scrolled past
  // Agent-chat context
  | 'agent-chat'
  | 'voice'
  | 'agent-chat-done'
  // Results
  | 'session-complete'
  | 'top-picks'
  | 'events'
  // Profile
  | 'profile'
  | 'profile-edit'

interface NavState {
  screen: Screen
  groupId: number // currently-selected group (chat room)
  go: (screen: Screen) => void
  setGroup: (id: number) => void
}

export const useNavStore = create<NavState>((set) => ({
  screen: 'sign-in',
  groupId: 7, // default matches the seeded session/messages
  go: (screen) => set({ screen }),
  setGroup: (id) => set({ groupId: id }),
}))

import { create } from 'zustand'
import type { Group } from '@/types'
import { MOCK_GROUPS } from '@/api/mock/groups.mock'
import { fetchGroups } from '@/api/groups.api'

// The user's group list. In live mode it's loaded from the gateway (each group
// carries its latest DB message as last_message, for the sidebar preview); in
// mock mode it's seeded from MOCK_GROUPS. New groups are still added locally
// (the create-group backend flow is future work).

interface GroupsState {
  groups: Group[]
  load: () => Promise<void>
  addGroup: (name: string) => Group
}

export const useGroupsStore = create<GroupsState>((set, get) => ({
  groups: MOCK_GROUPS,

  // Refresh the list from the backend (no-op-safe: falls back to current list
  // on failure so the sidebar never blanks out).
  load: async () => {
    try {
      set({ groups: await fetchGroups() })
    } catch {
      // Keep whatever's already shown.
    }
  },

  addGroup: (name) => {
    const trimmed = name.trim()
    // Client-side id above the seeded mock ids (7–10) so it never collides.
    const nextId = Math.max(10, ...get().groups.map((g) => g.id)) + 1
    const group: Group = { id: nextId, name: trimmed, emoji: '💬' }
    set((s) => ({ groups: [...s.groups, group] }))
    return group
  },
}))

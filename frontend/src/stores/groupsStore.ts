import { create } from 'zustand'
import type { Group } from '@/types'
import { MOCK_GROUPS } from '@/api/mock/groups.mock'

// The user's group list. Seeded from the mock groups; new groups are added
// locally (no backend yet). Local-only + ephemeral — created groups live only in
// this browser and reset to MOCK_GROUPS on reload. Real shared/invited groups
// need the users/GroupMember DB + auth (the WhatsApp-style flow), which is future
// work.

interface GroupsState {
  groups: Group[]
  addGroup: (name: string) => Group
}

export const useGroupsStore = create<GroupsState>((set, get) => ({
  groups: MOCK_GROUPS,

  addGroup: (name) => {
    const trimmed = name.trim()
    // Client-side id above the seeded mock ids (7–10) so it never collides.
    const nextId = Math.max(10, ...get().groups.map((g) => g.id)) + 1
    const group: Group = { id: nextId, name: trimmed, emoji: '💬' }
    set((s) => ({ groups: [...s.groups, group] }))
    return group
  },
}))

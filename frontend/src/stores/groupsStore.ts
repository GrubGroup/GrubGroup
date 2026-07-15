import { create } from 'zustand'
import { isAxiosError } from 'axios'
import type { Group } from '@/types'
import { USE_MOCK } from '@/lib/env'
import { MOCK_GROUPS } from '@/api/mock/groups.mock'
import { fetchGroups, createGroup, addGroupMember, removeGroupMember } from '@/api/groups.api'

// The user's group list. In live mode it's loaded from the gateway (each group
// carries its latest DB message as last_message, for the sidebar preview); in
// mock mode it's seeded from MOCK_GROUPS. Create + invite hit the real gateway
// endpoints (the caller is auto-added as a member server-side).

// Result of an invite attempt, so the UI can show success/error inline.
export interface InviteResult {
  ok: boolean
  error?: string
}

// The group to land in after sign-in: newest last message first, matching how
// GroupsSidebar sorts its list (message-less groups have no timestamp → 0, so
// they sink last). Returns undefined when the list is empty.
export function mostRecentGroup(groups: Group[]): Group | undefined {
  const activity = (g: Group) => {
    const ms = g.last_message?.at ? new Date(g.last_message.at).getTime() : 0
    return Number.isNaN(ms) ? 0 : ms
  }
  return groups.reduce<Group | undefined>(
    (best, g) => (best && activity(best) >= activity(g) ? best : g),
    undefined,
  )
}

interface GroupsState {
  groups: Group[]
  load: () => Promise<void>
  reset: () => void
  addGroup: (name: string, memberIds?: number[]) => Promise<Group>
  inviteMember: (groupId: number, username: string) => Promise<InviteResult>
  // Leave a group (remove yourself), then drop it from the list. In mock mode
  // it's removed locally.
  leaveGroup: (groupId: number, userId: number) => Promise<void>
}

export const useGroupsStore = create<GroupsState>((set, get) => ({
  // Live mode starts empty and is filled by load() from the gateway — seeding
  // MOCK_GROUPS here would leak the mock seed into a real (or freshly signed-up)
  // account's sidebar. Mock mode seeds the demo groups directly.
  groups: USE_MOCK ? MOCK_GROUPS : [],

  // Refresh the list from the backend. In mock mode a failure keeps the current
  // list (never blanks the demo). In live mode we clear on failure so one
  // account never shows another account's (or the mock) groups.
  load: async () => {
    try {
      set({ groups: await fetchGroups() })
    } catch {
      if (!USE_MOCK) set({ groups: [] })
    }
  },

  // Drop the current account's groups (call on sign-out so the next account
  // never sees the previous one's list before load() runs).
  reset: () => set({ groups: USE_MOCK ? MOCK_GROUPS : [] }),

  // Create a real group via POST /api/groups (with the picked member ids; the
  // caller is added server-side), then refresh the list so previews and counts
  // come from the DB. In mock mode, just push a local group.
  addGroup: async (name, memberIds) => {
    const trimmed = name.trim()
    if (USE_MOCK) {
      const nextId = Math.max(10, ...get().groups.map((g) => g.id)) + 1
      const group: Group = {
        id: nextId,
        name: trimmed,
        emoji: '💬',
        member_count: (memberIds?.length ?? 0) + 1, // + the caller
      }
      set((s) => ({ groups: [...s.groups, group] }))
      return group
    }
    const group = await createGroup(trimmed, memberIds)
    await get().load()
    return group
  },

  // Invite a member by username (POST /api/groups/:id/members). Surfaces the
  // gateway's error codes as friendly messages; refreshes the list on success.
  inviteMember: async (groupId, username) => {
    const name = username.trim()
    if (!name) return { ok: false, error: 'Enter a username.' }
    try {
      await addGroupMember(groupId, { username: name })
      await get().load()
      return { ok: true }
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined
      if (status === 404) return { ok: false, error: 'No user found with that username.' }
      if (status === 409) return { ok: false, error: 'That user is already a member.' }
      if (status === 403) return { ok: false, error: "You're not a member of this group." }
      return { ok: false, error: 'Could not add member. Try again.' }
    }
  },

  // Leave a group: remove yourself server-side, then drop it from the list. In
  // mock mode there's no request — just remove it locally.
  leaveGroup: async (groupId, userId) => {
    if (USE_MOCK) {
      set((s) => ({ groups: s.groups.filter((g) => g.id !== groupId) }))
      return
    }
    await removeGroupMember(groupId, userId)
    await get().load()
  },
}))

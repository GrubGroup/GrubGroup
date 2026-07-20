import type { Group, GroupDetail, GroupMember } from '@/types'
import { USE_MOCK } from '@/lib/env'
import { api } from '@/lib/axios'
import { MOCK_GROUPS } from './mock/groupsMock'
import { MOCK_MEMBER_NAMES } from './mock/sessionMock'

// The gateway returns groups the caller belongs to, each with its latest message
// (last_message) for the sidebar preview. Emoji is UI-only, so we backfill it
// from the mock list by id (falling back to a generic bubble).
const EMOJI_BY_ID: Record<number, string> = Object.fromEntries(
  MOCK_GROUPS.map((g) => [g.id, g.emoji]),
)

const withEmoji = (g: Group): Group => ({ ...g, emoji: g.emoji ?? EMOJI_BY_ID[g.id] ?? '💬' })

export async function fetchGroups(): Promise<Group[]> {
  if (USE_MOCK) return structuredClone(MOCK_GROUPS)
  const { data } = await api.get<Group[]>('/groups')
  return data.map(withEmoji)
}

// Create a group. The gateway auto-adds the caller as the first member;
// member_ids (integer user ids) seed additional members at creation.
export async function createGroup(name: string, member_ids?: number[]): Promise<Group> {
  if (USE_MOCK) {
    const nextId = Math.max(10, ...MOCK_GROUPS.map((g) => g.id)) + 1
    return { id: nextId, name, emoji: '💬' }
  }
  const { data } = await api.post<Group>('/groups', { name, ...(member_ids ? { member_ids } : {}) })
  return withEmoji(data)
}

// Add a member to a group by username (the person shares their username) or by
// user_id. There is no user-search endpoint, so username entry is the real path.
export async function addGroupMember(
  groupId: number,
  who: { username: string } | { user_id: number },
): Promise<void> {
  if (USE_MOCK) return
  await api.post(`/groups/${groupId}/members`, who)
}

// Remove a member from a group (or leave, when userId is the caller). Maps to
// DELETE /api/groups/:id/members/:user_id (204 on success). Mock is a no-op.
export async function removeGroupMember(groupId: number, userId: number): Promise<void> {
  if (USE_MOCK) return
  await api.delete(`/groups/${groupId}/members/${userId}`)
}

// A small mock roster so the group-detail panel isn't empty in mock mode.
// Built from the session mock's member names (ids 1-6). joined_at is static.
const MOCK_JOINED_AT = '2026-07-08T00:00:00.000Z'
const MOCK_GROUP_MEMBERS: GroupMember[] = Object.entries(MOCK_MEMBER_NAMES).map(([id, name]) => ({
  user_id: Number(id),
  display_name: name,
  avatar_url: null,
  joined_at: MOCK_JOINED_AT,
}))

// Group detail with its member list (joined to User).
export async function fetchGroup(groupId: number): Promise<GroupDetail> {
  if (USE_MOCK) {
    const g = MOCK_GROUPS.find((x) => x.id === groupId)
    return {
      id: groupId,
      name: g?.name ?? 'Group',
      emoji: g?.emoji ?? '💬',
      created_at: MOCK_JOINED_AT,
      members: MOCK_GROUP_MEMBERS,
    }
  }
  const { data } = await api.get<GroupDetail>(`/groups/${groupId}`)
  return { ...withEmoji(data), members: data.members ?? [] }
}

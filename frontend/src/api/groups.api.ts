import type { Group } from '@/types'
import { USE_MOCK } from '@/lib/env'
import { api } from '@/lib/axios'
import { MOCK_GROUPS } from './mock/groups.mock'

// The gateway returns groups the caller belongs to, each with its latest message
// (last_message) for the sidebar preview. Emoji is UI-only, so we backfill it
// from the mock list by id (falling back to a generic bubble).
const EMOJI_BY_ID: Record<number, string> = Object.fromEntries(
  MOCK_GROUPS.map((g) => [g.id, g.emoji]),
)

export async function fetchGroups(): Promise<Group[]> {
  if (USE_MOCK) return structuredClone(MOCK_GROUPS)
  const { data } = await api.get<Group[]>('/groups')
  return data.map((g) => ({ ...g, emoji: g.emoji ?? EMOJI_BY_ID[g.id] ?? '💬' }))
}

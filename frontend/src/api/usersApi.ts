import type { UserSearchResult } from '@/types'
import { api } from '@/lib/axios'

// Match the gateway: don't search on <2-char fragments.
const MIN_QUERY_LENGTH = 2

// Search users by username for the group member-picker (GET /api/users/search).
export async function searchUsers(q: string): Promise<UserSearchResult[]> {
  const query = q.trim()
  if (query.length < MIN_QUERY_LENGTH) return []
  const { data } = await api.get<UserSearchResult[]>('/users/search', { params: { q: query } })
  return data
}

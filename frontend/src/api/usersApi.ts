import type { UserSearchResult } from '@/types'
import { USE_MOCK } from '@/lib/env'
import { api } from '@/lib/axios'
import { MOCK_USERS } from './mock/usersMock'

// Match the gateway: don't search on <2-char fragments.
const MIN_QUERY_LENGTH = 2

// Search users by username for the group member-picker. Live mode hits
// GET /api/users/search; mock mode filters the local roster by username.
export async function searchUsers(q: string): Promise<UserSearchResult[]> {
  const query = q.trim()
  if (query.length < MIN_QUERY_LENGTH) return []
  if (USE_MOCK) {
    const lower = query.toLowerCase()
    return MOCK_USERS.filter((u) => u.username.includes(lower))
  }
  const { data } = await api.get<UserSearchResult[]>('/users/search', { params: { q: query } })
  return data
}

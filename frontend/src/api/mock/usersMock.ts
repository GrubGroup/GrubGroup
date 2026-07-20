import type { UserSearchResult } from '@/types'
import { MOCK_MEMBER_NAMES } from './sessionMock'

// Searchable mock users for the group member-picker in USE_MOCK mode. Built from
// the session mock's member roster (ids 2-6), excluding id 1 (the signed-in mock
// user, "you"). Usernames are the lowercased display name.
export const MOCK_USERS: UserSearchResult[] = Object.entries(MOCK_MEMBER_NAMES)
  .map(([id, name]) => ({
    id: Number(id),
    username: name.toLowerCase(),
    display_name: name,
    avatar_url: null,
  }))
  .filter((u) => u.id !== 1)

import type { SessionMember } from '@/types'
import { MOCK_MEMBER_NAMES } from '@/api/mock/sessionMock'

// Single source of truth for turning a user id into a display name across the
// session UI. Precedence: the live/mock roster's `display_name`, then its
// `username` (both returned per member by getSession/listMembers — username is
// the fallback when a user never set a display name) → the mock name map (demo
// fallback when no roster row is present, e.g. a chat author who isn't in the
// session roster) → a "User N" placeholder as a last resort. This replaces the
// scattered `MOCK_MEMBER_NAMES[id] ?? \`User ${id}\`` fallbacks so live mode shows
// real usernames and mock mode shows the seeded names.
export function nameForMember(
  userId: number | null | undefined,
  members?: SessionMember[],
): string {
  if (userId == null) return 'Someone'
  const row = members?.find((m) => m.user_id === userId)
  return (
    row?.display_name ?? row?.username ?? MOCK_MEMBER_NAMES[userId] ?? `User ${userId}`
  )
}

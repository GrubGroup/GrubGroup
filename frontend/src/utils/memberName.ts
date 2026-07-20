import type { SessionMember } from '@/types'
import { MOCK_MEMBER_NAMES } from '@/api/mock/sessionMock'

// Single source of truth for turning a user id into a display name across the
// session UI. Precedence: the live/mock roster's `display_name` (what
// getSession/listMembers return per member) → the mock name map (demo fallback
// when no roster row is present, e.g. a chat author who isn't in the session
// roster) → a "User N" placeholder as a last resort. This replaces the scattered
// `MOCK_MEMBER_NAMES[id] ?? \`User ${id}\`` fallbacks so live mode shows real
// usernames and mock mode shows the seeded names.
export function nameForMember(
  userId: number | null | undefined,
  members?: SessionMember[],
): string {
  if (userId == null) return 'Someone'
  const fromRoster = members?.find((m) => m.user_id === userId)?.display_name
  return fromRoster ?? MOCK_MEMBER_NAMES[userId] ?? `User ${userId}`
}

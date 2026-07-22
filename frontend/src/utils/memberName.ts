import type { SessionMember } from '@/types'

// Single source of truth for turning a user id into a display name across the
// session UI. Precedence: the roster's `display_name`, then its `username` (both
// returned per member by getSession/listMembers — username is the fallback when a
// user never set a display name) → a "User N" placeholder as a last resort (e.g.
// a chat author who isn't in the session roster).
export function nameForMember(
  userId: number | null | undefined,
  members?: SessionMember[],
): string {
  if (userId == null) return 'Someone'
  const row = members?.find((m) => m.user_id === userId)
  return row?.display_name ?? row?.username ?? `User ${userId}`
}

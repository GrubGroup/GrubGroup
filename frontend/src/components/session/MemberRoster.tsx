import type { SessionMember } from '@/types'
import { Avatar, Icon } from '@/components/ui'
import { MOCK_MEMBER_COLORS, MOCK_MEMBER_NAMES } from '@/api/mock/session.mock'

export interface MemberRosterProps {
  members: SessionMember[]
  currentUserId: number
}

// Roster of session members with per-member identity color + ready/chatting status.
export function MemberRoster({ members, currentUserId }: MemberRosterProps) {
  return (
    <ul className="flex flex-col gap-2">
      {members.map((m) => {
        const name = MOCK_MEMBER_NAMES[m.user_id] ?? `User ${m.user_id}`
        const isYou = m.user_id === currentUserId
        return (
          <li key={m.user_id} className="flex items-center gap-2">
            <Avatar name={name} size="sm" colorClass={MOCK_MEMBER_COLORS[m.user_id]} />
            <span className="flex-1 text-sm text-text">{isYou ? name : name}</span>
            {m.status ? (
              <span aria-label="ready" className="text-success">
                <Icon name="check" size={14} />
              </span>
            ) : (
              <span className="text-xs text-text-muted">chatting</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

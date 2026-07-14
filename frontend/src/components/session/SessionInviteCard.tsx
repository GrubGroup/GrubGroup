import type { Session } from '@/types'
import { Avatar, Badge, Card } from '@/components/ui'
import { MOCK_MEMBER_NAMES } from '@/api/mock/session.mock'

export interface SessionInviteCardProps {
  session: Session
  memberIds: number[]
}

// The "a session has started" invite preview shown before joining.
export function SessionInviteCard({ session, memberIds }: SessionInviteCardProps) {
  const hostName = MOCK_MEMBER_NAMES[session.host_user_id] ?? 'Someone'
  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Badge tone="primary">Active session</Badge>
        <span className="text-sm text-text-muted">{session.time_limit} min</span>
      </div>
      <div>
        <h2 className="font-display text-xl font-bold text-text">
          {hostName} started a session
        </h2>
        <p className="text-sm text-text-muted">
          Everyone talks to their own AI agent. One result works for the whole group.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {memberIds.slice(0, 5).map((id) => (
            <Avatar key={id} name={MOCK_MEMBER_NAMES[id] ?? `U${id}`} size="sm" />
          ))}
        </div>
        <span className="text-sm text-text-muted">{memberIds.length} people</span>
      </div>
    </Card>
  )
}

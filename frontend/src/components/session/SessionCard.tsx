import type { SessionMember } from '@/types'
import { Avatar, Button, Icon } from '@/components/ui'
import { SegmentedProgress } from './SegmentedProgress'
import { MOCK_MEMBER_COLORS } from '@/api/mock/session.mock'
import { nameForMember } from '@/utils/memberName'

type SessionCardState = 'not-joined' | 'continue' | 'waiting' | 'complete'

export interface SessionCardProps {
  state: SessionCardState
  members: SessionMember[]
  readyCount: number
  total: number
  onJoin?: () => void
  onContinue?: () => void
  onViewResults?: () => void
}

// The inline "session in progress" card shown inside the group chat. Its CTA
// changes with state: Join (not yet joined) / Continue (joined, in progress) /
// waiting label (user done).
export function SessionCard({
  state,
  members,
  readyCount,
  total,
  onJoin,
  onContinue,
  onViewResults,
}: SessionCardProps) {
  const complete = state === 'complete'
  return (
    <div className="rounded-card border border-primary/40 bg-surface-raised p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-pill bg-primary" />
          <span className="font-semibold text-text">
            {state === 'waiting'
              ? 'Waiting for others'
              : complete
                ? 'Session complete'
                : 'Session in progress'}
          </span>
        </div>
        {state === 'not-joined' && (
          <Button size="sm" variant="primary" onClick={onJoin}>
            Join
          </Button>
        )}
        {state === 'continue' && (
          <Button size="sm" variant="accent" onClick={onContinue}>
            Continue
          </Button>
        )}
        {complete && (
          <button
            onClick={onViewResults}
            className="flex items-center gap-1.5 rounded-input bg-success px-3 py-1.5 text-xs font-medium text-white"
          >
            <Icon name="utensils" size={12} /> View results
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex -space-x-1.5">
          {members.slice(0, 6).map((m) => (
            <Avatar
              key={m.user_id}
              name={nameForMember(m.user_id, members)}
              size="sm"
              colorClass={MOCK_MEMBER_COLORS[m.user_id]}
              className="h-5 w-5 border-2 border-surface-raised text-[8px]"
            />
          ))}
        </div>
        <span className="text-xs text-text-muted">
          {readyCount} of {total} ready
        </span>
      </div>

      <div className="mt-2">
        <SegmentedProgress value={readyCount} total={total} tone="primary" />
      </div>
    </div>
  )
}

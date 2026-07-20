import type { GroupMessage } from '@/types'
import { Avatar } from '@/components/ui'
import { MOCK_MEMBER_COLORS } from '@/api/mock/session.mock'
import { nameForMember } from '@/utils/memberName'

export interface GroupMessageRowProps {
  message: GroupMessage
  currentUserId: number
}

// Format an ISO timestamp as a short local time, e.g. "11:42 AM".
function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function GroupMessageRow({ message, currentUserId }: GroupMessageRowProps) {
  // Restaurant recommendations no longer appear in the group chat — they live in
  // the session/results flow only. Swallow any legacy SESSION_BLOCK row (its text
  // is empty, so falling through would render a blank bubble).
  if (message.type === 'session_block') {
    return null
  }

  // System lines (e.g. "Sophie has left the group") render as a centered divider,
  // matching the "… started a session" style.
  if (message.type === 'system') {
    return (
      <div className="flex items-center gap-3 py-1 text-xs text-text-muted">
        <span className="h-px flex-1 bg-border" />
        {message.text}
        <span className="h-px flex-1 bg-border" />
      </div>
    )
  }

  const isOwn = message.userId === currentUserId
  const name = message.name ?? nameForMember(message.userId)
  const time = formatTime(message.at)

  if (isOwn) {
    return (
      <div className="flex items-end justify-end gap-2">
        <span className="text-[10px] text-text-muted">{time}</span>
        <div className="max-w-[70%] rounded-2xl rounded-tr-md bg-surface-inverse px-3.5 py-2 text-[13px] text-white">
          {message.text}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2.5">
      <Avatar name={name} size="sm" colorClass={MOCK_MEMBER_COLORS[message.userId ?? -1]} />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-text-muted">{name}</span>
        <div className="flex items-end gap-2">
          <div className="max-w-md rounded-2xl rounded-tl-md bg-surface-sunken px-3.5 py-2 text-[13px] text-text">
            {message.text}
          </div>
          <span className="text-[10px] text-text-muted">{time}</span>
        </div>
      </div>
    </div>
  )
}

import type { GroupMessage, SessionMember } from '@/types'
import { Avatar } from '@/components/ui'
import { cn } from '@/utils/cn'
import { memberColor } from '@/constants/memberColors'
import { nameForMember } from '@/utils/memberName'

export interface GroupMessageRowProps {
  message: GroupMessage
  currentUserId: number
  /** True only for a message that just arrived — triggers the bubble pop. */
  isNew?: boolean
  /** Session roster, so a chat author's name resolves to their real name. */
  members?: SessionMember[]
}

// Format an ISO timestamp as a short local time, e.g. "11:42 AM".
function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function GroupMessageRow({ message, currentUserId, isNew = false, members }: GroupMessageRowProps) {
  // Restaurant recommendations no longer appear in the group chat — they live in
  // the session/results flow only. Swallow any legacy SESSION_BLOCK row (its text
  // is empty, so falling through would render a blank bubble).
  if (message.type === 'session_block') {
    return null
  }

  // Freshly arrived messages pop in (scale 0→100% with a spring overshoot, via
  // the animate-bubble-pop CSS utility). History renders static.
  const pop = isNew ? 'animate-bubble-pop' : undefined

  // System lines (e.g. "Sophie has left the group") render as a centered divider,
  // matching the "… started a session" style.
  if (message.type === 'system') {
    return (
      <div className={cn('flex items-center gap-3 py-1 text-caption text-text-muted', pop)}>
        <span className="h-px flex-1 bg-border" />
        {message.text}
        <span className="h-px flex-1 bg-border" />
      </div>
    )
  }

  const isOwn = message.userId === currentUserId
  const name = message.name ?? nameForMember(message.userId, members)
  const time = formatTime(message.at)

  if (isOwn) {
    return (
      <div className={cn('flex items-end justify-end gap-2', pop)}>
        <span className="text-caption text-text-muted">{time}</span>
        <div className="max-w-[70%] rounded-2xl rounded-tr-md bg-surface-inverse px-3.5 py-2 text-body text-white">
          {message.text}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex items-start gap-2.5', pop)}>
      <Avatar name={name} size="sm" colorClass={memberColor(message.userId ?? -1)} />
      <div className="flex flex-col gap-0.5">
        <span className="text-caption text-text-muted">{name}</span>
        <div className="flex items-end gap-2">
          <div className="max-w-md rounded-2xl rounded-tl-md bg-surface-sunken px-3.5 py-2 text-body text-text">
            {message.text}
          </div>
          <span className="text-caption text-text-muted">{time}</span>
        </div>
      </div>
    </div>
  )
}

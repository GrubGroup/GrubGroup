import type { GroupMsg } from '@/api/mock/groupChat.mock'
import { Avatar } from '@/components/ui'
import { MOCK_MEMBER_COLORS, MOCK_MEMBER_NAMES } from '@/api/mock/session.mock'

export interface GroupMessageRowProps {
  message: GroupMsg
  currentUserId: number
}

export function GroupMessageRow({ message, currentUserId }: GroupMessageRowProps) {
  const isOwn = message.userId === currentUserId
  const name = MOCK_MEMBER_NAMES[message.userId] ?? `User ${message.userId}`

  if (isOwn) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="max-w-[70%] rounded-2xl rounded-tr-md bg-surface-inverse px-3.5 py-2 text-[13px] text-white">
          {message.text}
        </div>
        <span className="text-[10px] text-text-muted">{message.time}</span>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2.5">
      <Avatar name={name} size="sm" colorClass={MOCK_MEMBER_COLORS[message.userId]} />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-text-muted">{name}</span>
        <div className="max-w-md rounded-2xl rounded-tl-md bg-surface-sunken px-3.5 py-2 text-[13px] text-text">
          {message.text}
        </div>
        <span className="text-[10px] text-text-muted">{message.time}</span>
      </div>
    </div>
  )
}

import type { ChatMessage as ChatMessageType } from '@/types'

export interface ChatMessageProps {
  message: ChatMessageType
}

export function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === 'system') {
    return <p className="mx-auto max-w-md text-center text-xs text-text-muted">{message.text}</p>
  }

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-lg bg-bubble-user px-3.5 py-2.5 text-[13px] leading-relaxed text-white">
          {message.text}
        </div>
      </div>
    )
  }

  // Agent
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-pill bg-surface-inverse text-[10px] text-white">
          🍽
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          Food agent
        </span>
      </div>
      <div className="rounded-2xl border border-border bg-surface-raised px-4 py-3 text-[13px] leading-relaxed text-text shadow-sm">
        {message.text}
      </div>
    </div>
  )
}

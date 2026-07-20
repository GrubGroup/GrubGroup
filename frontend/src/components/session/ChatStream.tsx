import { useEffect, useRef } from 'react'
import { ChatMessage } from './ChatMessage'
import { Icon } from '@/components/ui'
import { useChatStore } from '@/stores/chatStore'

export interface ChatStreamProps {
  /** When true, appends the "You're done · waiting for the group" pill in-stream. */
  done?: boolean
}

export function ChatStream({ done = false }: ChatStreamProps) {
  const messages = useChatStore((s) => s.messages)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, done])

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-gutter">
      {messages.map((m) => (
        <ChatMessage key={m.id} message={m} />
      ))}
      {done && (
        <div className="flex justify-center pt-1">
          <span className="flex items-center gap-2 rounded-pill border border-border bg-surface-raised px-4 py-2 text-sm text-text-muted shadow-sm">
            <span className="text-success">
              <Icon name="check" size={14} />
            </span>
            You're finished · waiting for others
          </span>
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}

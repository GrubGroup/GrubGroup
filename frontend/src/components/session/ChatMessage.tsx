import { motion, useReducedMotion } from 'framer-motion'
import type { ChatMessage as ChatMessageType } from '@/types'
import { EASE } from '@/lib/motion'

export interface ChatMessageProps {
  message: ChatMessageType
}

export function ChatMessage({ message }: ChatMessageProps) {
  const reduce = useReducedMotion()

  let content
  if (message.role === 'system') {
    content = (
      <p className="mx-auto max-w-md text-center text-caption text-text-muted">{message.text}</p>
    )
  } else if (message.role === 'user') {
    content = (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-lg bg-bubble-user px-3.5 py-2.5 text-body text-white">
          {message.text}
        </div>
      </div>
    )
  } else {
    // Agent
    content = (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-pill bg-surface-inverse text-[10px] text-white">
            🍽
          </span>
          <span className="text-overline font-semibold uppercase tracking-wide text-text-muted">
            Food agent
          </span>
        </div>
        <div className="rounded-2xl border border-border bg-surface-raised px-4 py-3 text-body text-text shadow-sm">
          {message.text}
        </div>
      </div>
    )
  }

  // Fade + rise as each message arrives, so streamed agent replies feel alive.
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0.2 : 0.3, ease: EASE }}
    >
      {content}
    </motion.div>
  )
}

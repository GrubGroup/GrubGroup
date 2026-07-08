import { useState } from 'react'
import { Icon } from '@/components/ui'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import { cn } from '@/utils/cn'

export interface VoiceComposerProps {
  onSend: (text: string) => void
  disabled?: boolean
  /** Placeholder for the text input. */
  placeholder?: string
  /** Show the "Only you can see this" privacy caption (agent chat only). */
  privacyNote?: boolean
}

// Shared message bar used by BOTH the agent chat and the group chat: a
// prominent dark circular mic button, a fully-rounded pill text input, and a
// circular send button. While listening, the mic turns orange and a waveform +
// "Listening…" shows in the pill.
export function VoiceComposer({
  onSend,
  disabled,
  placeholder = 'Or type a message...',
  privacyNote = false,
}: VoiceComposerProps) {
  const { transcript, listening, resetTranscript, supported, start, stop } = useVoiceInput()
  const [text, setText] = useState('')

  const displayValue = listening ? transcript : text

  const handleSend = () => {
    const value = displayValue.trim()
    if (!value) return
    onSend(value)
    setText('')
    resetTranscript()
    if (listening) stop()
  }

  const toggleMic = () => {
    if (listening) stop()
    else {
      resetTranscript()
      start()
    }
  }

  return (
    <div className="border-t border-border bg-surface-raised px-4 pb-3 pt-3">
      <div className="flex items-center gap-3">
        {/* Distinct circular mic button */}
        {supported && (
          <button
            type="button"
            aria-label={listening ? 'Stop listening' : 'Start voice input'}
            disabled={disabled}
            onClick={toggleMic}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-pill shadow-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
              listening
                ? 'animate-pulse bg-primary text-on-primary'
                : 'bg-surface-inverse text-white hover:opacity-90',
            )}
          >
            <Icon name="mic" size={18} />
          </button>
        )}

        {/* Rounded pill input (or waveform while listening) */}
        {listening ? (
          <div className="flex h-11 flex-1 items-center gap-3 rounded-pill bg-surface-sunken px-5">
            <div className="flex items-center gap-0.5" aria-hidden="true">
              {[6, 12, 20, 10, 16, 8, 22, 12, 6, 14, 9, 18, 7, 15].map((h, i) => (
                <span
                  key={i}
                  className="w-0.5 rounded-pill bg-text/70"
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>
            <span className="text-sm text-text-muted">Listening…</span>
          </div>
        ) : (
          <input
            value={displayValue}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend()
            }}
            className={cn(
              'h-11 flex-1 rounded-pill bg-surface-sunken px-5 text-sm text-text',
              'placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus-ring',
            )}
          />
        )}

        {/* Circular send button */}
        <button
          type="button"
          aria-label="Send message"
          disabled={disabled || !displayValue.trim()}
          onClick={handleSend}
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-surface-sunken text-text-muted transition-colors',
            'hover:bg-surface-inverse hover:text-white',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface-sunken disabled:hover:text-text-muted',
          )}
        >
          <Icon name="send" size={15} />
        </button>
      </div>

      {privacyNote && (
        <p className="mt-2 text-center text-[10px] text-text-subtle">
          Only you can see this · your privacy is protected
        </p>
      )}
    </div>
  )
}

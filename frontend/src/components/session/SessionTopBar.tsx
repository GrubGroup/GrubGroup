import { Icon } from '@/components/ui'
import { SessionTimer } from './SessionTimer'
import { COLUMN_HEADER_H } from '@/components/layout/AppSidebar'
import { cn } from '@/utils/cn'
import { useSessionStore } from '@/stores/sessionStore'

export interface SessionTopBarProps {
  /** Center label; the wireframe uses "Your food agent". */
  label?: string
}

// Full-width session bar mounted ABOVE the three-column layout. Shows the private
// "Your food agent" label (left) and the live countdown (center). When the timer
// expires, the HOST client alone triggers generation (force_partial=true) — the
// gateway broadcasts session:picks to everyone, so non-hosts do nothing here.
export function SessionTopBar({ label = 'Your food agent' }: SessionTopBarProps) {
  const session = useSessionStore((s) => s.session)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const startedAt = useSessionStore((s) => s.startedAt)
  // The timer is now only a FALLBACK: auto-complete generates results the moment
  // every member finishes (server-side live, simulated in mock). The host-only
  // expiry generation is centralized in the store, shared with the group-chat
  // card timer — see sessionStore.triggerExpiryGeneration.
  const triggerExpiryGeneration = useSessionStore((s) => s.triggerExpiryGeneration)

  if (activeSessionId == null || session == null) return null

  return (
    <div
      className={cn(
        'relative flex items-center justify-between border-b border-border bg-surface-panel px-5',
        COLUMN_HEADER_H,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-pill bg-surface-inverse text-[11px] text-white">
          🍽
        </span>
        <span className="flex items-center gap-1.5 text-body font-semibold text-text">
          {label}
        </span>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2">
        <SessionTimer
          startedAt={startedAt}
          minutes={session.time_limit}
          onExpire={() => void triggerExpiryGeneration()}
        />
      </div>

      <div className="flex items-center gap-1.5 text-overline uppercase tracking-wide text-text-muted">
        <Icon name="lock" size={11} /> Private
      </div>
    </div>
  )
}

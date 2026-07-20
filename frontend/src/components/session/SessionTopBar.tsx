import { useRef } from 'react'
import { Icon } from '@/components/ui'
import { SessionTimer } from './SessionTimer'
import { COLUMN_HEADER_H } from '@/components/layout/AppSidebar'
import { cn } from '@/utils/cn'
import { USE_MOCK } from '@/lib/env'
import { useSessionStore } from '@/stores/sessionStore'
import { generateRecommendation } from '@/api/session.api'

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
  const isHost = useSessionStore((s) => s.isHost())
  const recommendation = useSessionStore((s) => s.recommendation)
  const receivePicks = useSessionStore((s) => s.receivePicks)
  const generatingRef = useRef(false)

  if (activeSessionId == null || session == null) return null

  // The timer is now only a FALLBACK: auto-complete generates results the moment
  // every member finishes (server-side live, simulated in mock). If results
  // already exist, there's nothing for the timer to force.
  const handleExpire = async () => {
    if (!isHost || generatingRef.current || recommendation != null) return
    generatingRef.current = true
    try {
      const rec = await generateRecommendation(activeSessionId, { forcePartial: true })
      // Live: the gateway broadcasts session:picks, so results land via the
      // socket. Offline (mock, socket null) there is no broadcast — adopt the
      // recommendation into the store so the Results affordance appears.
      if (USE_MOCK) {
        receivePicks({
          recommendationId: rec.id,
          sessionId: activeSessionId,
          items: rec.items,
        })
      }
    } catch {
      // A generation failure (e.g. members not ready → 409) is surfaced elsewhere;
      // don't crash the bar. Allow a later manual retry.
      generatingRef.current = false
    }
  }

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
        <span className="flex items-center gap-1.5 text-sm font-semibold text-text">
          {label}
        </span>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2">
        <SessionTimer startedAt={startedAt} minutes={session.time_limit} onExpire={handleExpire} />
      </div>

      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-text-muted">
        <Icon name="lock" size={11} /> Private
      </div>
    </div>
  )
}

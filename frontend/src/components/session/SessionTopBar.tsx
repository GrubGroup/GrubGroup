import { useRef } from 'react'
import { Icon } from '@/components/ui'
import { SessionTimer } from './SessionTimer'
import { COLUMN_HEADER_H } from '@/components/layout/AppSidebar'
import { cn } from '@/utils/cn'
import { USE_MOCK } from '@/lib/env'
import { useSessionStore } from '@/stores/sessionStore'
import { useGroupChatStore } from '@/stores/groupChatStore'
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
  const generatingRef = useRef(false)

  if (activeSessionId == null || session == null) return null

  const handleExpire = async () => {
    if (!isHost || generatingRef.current) return
    generatingRef.current = true
    try {
      const rec = await generateRecommendation(activeSessionId, { forcePartial: true })
      // Live: the gateway persists a SESSION_BLOCK message + broadcasts
      // session:picks, so the card lands via the socket. Offline (mock, socket
      // null) there is no broadcast — inject the picks block locally so the
      // in-chat card still appears.
      if (USE_MOCK && session.group_id != null) {
        useGroupChatStore.getState().receiveMessage({
          id: `picks-${rec.id}`,
          groupId: session.group_id,
          userId: session.host_user_id,
          name: null,
          text: '',
          at: new Date().toISOString(),
          type: 'session_block',
          block: {
            kind: 'top_picks',
            session_id: activeSessionId,
            recommendation_id: rec.id,
            items: rec.items,
          },
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

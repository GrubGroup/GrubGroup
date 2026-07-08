import { MemberRoster } from './MemberRoster'
import { SegmentedProgress } from './SegmentedProgress'
import { useSessionStore } from '@/stores/sessionStore'

export interface GroupProgressPanelProps {
  /** Render only the header band (title + count + segmented bar). */
  headerOnly?: boolean
  /** Render only the member roster. */
  rosterOnly?: boolean
}

// Right-panel content: "Group progress N/total" + segmented bar (header) and the
// member roster (body). Split via props so the header can align to the shared
// column header height while the roster scrolls below it.
export function GroupProgressPanel({ headerOnly, rosterOnly }: GroupProgressPanelProps) {
  const members = useSessionStore((s) => s.members)
  const currentUserId = useSessionStore((s) => s.currentUserId)
  const doneCount = useSessionStore((s) => s.doneCount())

  if (rosterOnly) {
    return <MemberRoster members={members} currentUserId={currentUserId} />
  }

  const header = (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text">Group progress</span>
        <span className="text-xs font-semibold text-text-muted">
          {doneCount}/{members.length}
        </span>
      </div>
      <SegmentedProgress value={doneCount} total={members.length} />
    </div>
  )

  if (headerOnly) return header

  // Full (fallback): header + roster.
  return (
    <div className="flex flex-col gap-3">
      {header}
      <MemberRoster members={members} currentUserId={currentUserId} />
    </div>
  )
}

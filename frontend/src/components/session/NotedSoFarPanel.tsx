import { Icon } from '@/components/ui'
import { useChatStore } from '@/stores/chatStore'

// "Noted so far" — captured preferences as white cards with a check (or a
// hollow dot for pending items), matching the wireframe.
export function NotedSoFarPanel() {
  const noted = useChatStore((s) => s.notedPreferences)

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        Noted so far
      </h3>
      <ul className="flex flex-col gap-1.5">
        {noted.map((n) => (
          <li
            key={n.id}
            className={
              n.confirmed
                ? 'flex items-center gap-2 rounded-input bg-surface-raised px-2.5 py-2 text-xs text-text'
                : 'flex items-center gap-2 rounded-input px-2.5 py-2 text-xs text-text-subtle'
            }
          >
            <span className={n.confirmed ? 'text-success' : 'text-text-subtle'}>
              <Icon name={n.confirmed ? 'check' : 'circle'} size={14} />
            </span>
            {n.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

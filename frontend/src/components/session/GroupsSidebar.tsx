import { Icon } from '@/components/ui'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { useNavStore } from '@/stores/navStore'
import { cn } from '@/utils/cn'

// Recent group chats shown in the left sidebar (mock, matches wireframe).
const GROUPS = [
  { emoji: '🍱', name: 'Work Lunch Crew', preview: 'Tomás: Just joined the session 🎉', time: '2m', active: true },
  { emoji: '🍕', name: 'Friday Friends', preview: 'Dev: This Friday?', time: '1h' },
  { emoji: '☕', name: 'Dev + Maya', preview: 'Maya: See you there!', time: '3h' },
  { emoji: '🍷', name: 'Date Night', preview: 'Priya: Saturday works 😊', time: '1d' },
]

// Left column for the group-chat / agent-chat context: AppSidebar with the
// recent-groups list as its body.
export function GroupsSidebar() {
  const go = useNavStore((s) => s.go)

  return (
    <AppSidebar activeTab="groups">
      <button
        onClick={() => go('group-chat')}
        className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left"
      >
        <span className="text-text-muted">
          <Icon name="plus" size={14} />
        </span>
        <span className="text-xs font-medium text-text-muted">New group</span>
      </button>
      {GROUPS.map((g) => (
        <div
          key={g.name}
          className={cn(
            'flex items-center gap-3 border-b border-border px-4 py-3',
            g.active && 'bg-surface-raised/40',
          )}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-surface-raised text-lg">
            {g.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="truncate text-[13px] font-semibold text-text">{g.name}</span>
              <span className="text-[10px] text-text-muted">{g.time}</span>
            </div>
            <p className="truncate text-xs text-text-muted">{g.preview}</p>
          </div>
        </div>
      ))}
    </AppSidebar>
  )
}

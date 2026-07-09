import { Icon } from '@/components/ui'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { useNavStore } from '@/stores/navStore'
import { MOCK_GROUPS } from '@/api/mock/groups.mock'
import { cn } from '@/utils/cn'

// Left column for the group-chat / agent-chat context: AppSidebar with the
// recent-groups list as its body. Clicking a group selects it as the active
// chat room and navigates to the group-chat screen.
export function GroupsSidebar() {
  const go = useNavStore((s) => s.go)
  const groupId = useNavStore((s) => s.groupId)
  const setGroup = useNavStore((s) => s.setGroup)

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
      {MOCK_GROUPS.map((g) => (
        <button
          key={g.id}
          onClick={() => {
            setGroup(g.id)
            go('group-chat')
          }}
          className={cn(
            'flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left',
            g.id === groupId && 'bg-surface-raised/40',
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
        </button>
      ))}
    </AppSidebar>
  )
}

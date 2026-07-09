import { useState } from 'react'
import { Icon } from '@/components/ui'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { NewGroupModal } from '@/components/session/NewGroupModal'
import { useNavStore } from '@/stores/navStore'
import { useGroupsStore } from '@/stores/groupsStore'
import { cn } from '@/utils/cn'

// Left column for the group-chat / agent-chat context: AppSidebar with the
// recent-groups list as its body. Clicking a group selects it as the active
// chat room; "New group" opens a name prompt and creates one (local-only).
export function GroupsSidebar() {
  const go = useNavStore((s) => s.go)
  const groupId = useNavStore((s) => s.groupId)
  const setGroup = useNavStore((s) => s.setGroup)
  const groups = useGroupsStore((s) => s.groups)
  const addGroup = useGroupsStore((s) => s.addGroup)

  const [modalOpen, setModalOpen] = useState(false)

  const handleCreate = (name: string) => {
    const group = addGroup(name)
    setGroup(group.id)
    go('group-chat')
    setModalOpen(false)
  }

  return (
    <AppSidebar activeTab="groups">
      <button
        onClick={() => setModalOpen(true)}
        className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left"
      >
        <span className="text-text-muted">
          <Icon name="plus" size={14} />
        </span>
        <span className="text-xs font-medium text-text-muted">New group</span>
      </button>
      {groups.map((g) => (
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

      <NewGroupModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
      />
    </AppSidebar>
  )
}

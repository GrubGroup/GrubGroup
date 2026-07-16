import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { NewGroupModal } from '@/components/session/NewGroupModal'
import { useNavStore } from '@/stores/navStore'
import { useGroupsStore } from '@/stores/groupsStore'
import { useGroupChatStore } from '@/stores/groupChatStore'
import { timeAgo } from '@/utils/timeAgo'
import { cn } from '@/utils/cn'
import type { Group } from '@/types'

// Resolve the preview line + relative time for a group's sidebar row. Prefers a
// live message from the open chat (so it updates in real time as you chat), then
// the group's last_message from the DB, then the static mock preview. System
// lines (e.g. "X has left the group") are skipped — they aren't chat previews.
function usePreview(group: Group): { preview: string; time: string } {
  const live = useGroupChatStore((s) => s.messagesByGroup[group.id])
  const latest = live?.findLast((m) => m.type !== 'system')
  if (latest) {
    const who = latest.name ? `${latest.name}: ` : ''
    return { preview: `${who}${latest.text}`, time: timeAgo(latest.at) }
  }
  if (group.last_message) {
    const who = group.last_message.name ? `${group.last_message.name}: ` : ''
    return { preview: `${who}${group.last_message.text}`, time: timeAgo(group.last_message.at) }
  }
  return { preview: group.preview ?? 'No messages yet', time: group.time ?? '' }
}

// A group's last-activity time (epoch ms), matching usePreview's precedence:
// newest non-system live message → DB last_message → 0 (message-less sink last).
function lastActivity(
  group: Group,
  messagesByGroup: Record<number, { at: string; type?: string }[]>,
): number {
  const live = messagesByGroup[group.id]
  const at = live?.findLast((m) => m.type !== 'system')?.at ?? group.last_message?.at
  const ms = at ? new Date(at).getTime() : 0
  return Number.isNaN(ms) ? 0 : ms
}

// One sidebar row. Split out so usePreview can subscribe per-group to live chat.
function GroupRow({ group }: { group: Group }) {
  const go = useNavStore((s) => s.go)
  const groupId = useNavStore((s) => s.groupId)
  const setGroup = useNavStore((s) => s.setGroup)
  const { preview, time } = usePreview(group)

  return (
    <button
      onClick={() => {
        setGroup(group.id)
        go('group-chat')
      }}
      className={cn(
        'flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left',
        group.id === groupId && 'bg-surface-raised/40',
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-surface-raised text-lg">
        {group.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="truncate text-[13px] font-semibold text-text">{group.name}</span>
          <span className="text-[10px] text-text-muted">{time}</span>
        </div>
        <p className="truncate text-xs text-text-muted">{preview}</p>
      </div>
    </button>
  )
}

// Left column for the group-chat / agent-chat context: AppSidebar with the
// recent-groups list as its body. Clicking a group selects it as the active
// chat room; "New group" opens a name prompt and creates one (local-only).
export function GroupsSidebar() {
  const go = useNavStore((s) => s.go)
  const setGroup = useNavStore((s) => s.setGroup)
  const groups = useGroupsStore((s) => s.groups)
  const addGroup = useGroupsStore((s) => s.addGroup)
  const load = useGroupsStore((s) => s.load)
  // Subscribe at this level so the list re-sorts live as new messages arrive.
  const messagesByGroup = useGroupChatStore((s) => s.messagesByGroup)

  const [modalOpen, setModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  // Newest activity first (WhatsApp-style); sort a copy, never the store array.
  const sortedGroups = [...groups].sort(
    (a, b) => lastActivity(b, messagesByGroup) - lastActivity(a, messagesByGroup),
  )

  // Load the real group list (with last messages) on mount. No-op in mock mode.
  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async (name: string, memberIds: number[]) => {
    setCreating(true)
    try {
      const group = await addGroup(name, memberIds)
      setGroup(group.id)
      go('group-chat')
      setModalOpen(false)
    } finally {
      setCreating(false)
    }
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
      {sortedGroups.map((g) => (
        <GroupRow key={g.id} group={g} />
      ))}

      <NewGroupModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        pending={creating}
      />
    </AppSidebar>
  )
}

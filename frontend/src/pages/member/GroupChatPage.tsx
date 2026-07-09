import { useEffect } from 'react'
import { GroupsSidebar } from '@/components/session/GroupsSidebar'
import { GroupMessageRow } from '@/components/session/GroupMessageRow'
import { SessionCard } from '@/components/session/SessionCard'
import { Avatar, Icon } from '@/components/ui'
import { COLUMN_HEADER_H } from '@/components/layout/AppSidebar'
import { VoiceComposer } from '@/components/voice/VoiceComposer'
import { cn } from '@/utils/cn'
import { SESSION_STARTED_BY } from '@/api/mock/groupChat.mock'
import { MOCK_GROUPS } from '@/api/mock/groups.mock'
import { MOCK_MEMBER_COLORS, MOCK_MEMBER_NAMES } from '@/api/mock/session.mock'
import { useSessionStore } from '@/stores/sessionStore'
import { useAuthStore } from '@/stores/authStore'
import { useNavStore } from '@/stores/navStore'
import { useGroupChatStore, selectGroupMessages } from '@/stores/groupChatStore'
import { useSocket } from '@/hooks/useSocket'

// Card state derives from which group-chat screen we're on.
const CARD_STATE: Record<string, 'not-joined' | 'continue' | 'waiting' | 'complete'> = {
  'group-chat': 'not-joined',
  'session-continue': 'continue',
  'session-waiting': 'waiting',
  'session-complete': 'complete',
}

export function GroupChatPage() {
  const screen = useNavStore((s) => s.screen)
  const go = useNavStore((s) => s.go)
  const groupId = useNavStore((s) => s.groupId)
  const members = useSessionStore((s) => s.members)
  const doneCount = useSessionStore((s) => s.doneCount())
  const join = useSessionStore((s) => s.join)
  const loadSession = useSessionStore((s) => s.load)
  const currentUserId = useAuthStore((s) => s.user?.id ?? 1)

  // Live group chat: connect + join the selected room (no-op in mock mode).
  useSocket(groupId)
  const messages = useGroupChatStore(selectGroupMessages(groupId))
  const sendMessage = useGroupChatStore((s) => s.sendMessage)

  const groupName = MOCK_GROUPS.find((g) => g.id === groupId)?.name ?? 'Group'

  useEffect(() => {
    if (members.length === 0) void loadSession(42, currentUserId)
  }, [members.length, loadSession, currentUserId])

  const cardState = CARD_STATE[screen] ?? 'not-joined'
  const memberIds = members.map((m) => m.user_id)
  const total = members.length || 6

  const handleJoin = () => {
    join()
    go('agent-chat')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-raised">
      <GroupsSidebar />

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {/* Header — same height as sidebar/right-panel headers for seamless borders */}
        <div className={cn('flex items-center justify-between border-b border-border px-5', COLUMN_HEADER_H)}>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-[15px] font-bold text-text">{groupName}</span>
              <div className="flex -space-x-1.5">
                {memberIds.slice(0, 5).map((id) => (
                  <Avatar
                    key={id}
                    name={MOCK_MEMBER_NAMES[id] ?? '?'}
                    size="sm"
                    colorClass={MOCK_MEMBER_COLORS[id]}
                    className="h-4 w-4 border border-surface-raised text-[7px]"
                  />
                ))}
              </div>
            </div>
            <p className="text-xs text-text-muted">
              {total} members · <span className="text-primary">session active</span>
            </p>
          </div>
          {cardState === 'not-joined' && (
            <button
              onClick={handleJoin}
              className="flex items-center gap-1.5 rounded-input bg-surface-inverse px-3 py-1.5 text-xs font-medium text-white"
            >
              <Icon name="sparkles" size={12} /> Start session
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          {/* Session-started divider + card */}
          <div className="flex items-center gap-3 py-1 text-xs text-text-muted">
            <span className="h-px flex-1 bg-border" />
            {MOCK_MEMBER_NAMES[SESSION_STARTED_BY]} started a session
            <span className="h-px flex-1 bg-border" />
          </div>
          <SessionCard
            state={cardState}
            memberIds={memberIds}
            readyCount={cardState === 'complete' ? total : doneCount}
            total={total}
            onJoin={handleJoin}
            onContinue={() => go('agent-chat')}
            onViewResults={() => go('top-picks')}
          />

          {/* Live messages (server echo in live mode; seeded mocks in mock mode) */}
          {messages.map((m) => (
            <GroupMessageRow key={m.id} message={m} currentUserId={currentUserId} />
          ))}
        </div>

        {/* Composer — same reusable message bar as the agent chat */}
        <VoiceComposer onSend={(text) => sendMessage(groupId, text)} placeholder="Message" />
      </div>
    </div>
  )
}

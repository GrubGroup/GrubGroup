import { useEffect, useState } from 'react'
import type { Session } from '@/types'
import { GroupsSidebar } from '@/components/session/GroupsSidebar'
import { GroupMessageRow } from '@/components/session/GroupMessageRow'
import { SessionCard } from '@/components/session/SessionCard'
import { GroupDetailPanel } from '@/components/session/GroupDetailPanel'
import { HostSessionModal } from '@/components/session/HostSessionModal'
import { Avatar, Icon } from '@/components/ui'
import { COLUMN_HEADER_H } from '@/components/layout/AppSidebar'
import { VoiceComposer } from '@/components/voice/VoiceComposer'
import { TypingIndicator } from '@/components/session/TypingIndicator'
import { cn } from '@/utils/cn'
import { USE_MOCK } from '@/lib/env'
import {
  SESSION_STARTED_BY,
  MOCK_GROUP_MESSAGES,
  MOCK_GROUP_MESSAGES_AFTER,
} from '@/api/mock/groupChat.mock'
import { MOCK_MEMBER_COLORS, MOCK_MEMBER_NAMES } from '@/api/mock/session.mock'
import { nameForMember } from '@/utils/memberName'
import { useSessionStore } from '@/stores/sessionStore'
import { useAuthStore } from '@/stores/authStore'
import { useNavStore } from '@/stores/navStore'
import { useGroupsStore, mostRecentGroup } from '@/stores/groupsStore'
import {
  useGroupChatStore,
  selectGroupMessages,
  selectSessionStartIndex,
  selectTypers,
} from '@/stores/groupChatStore'
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
  const setGroup = useNavStore((s) => s.setGroup)
  const groupId = useNavStore((s) => s.groupId)
  const members = useSessionStore((s) => s.members)
  const doneCount = useSessionStore((s) => s.doneCount())
  const progressTotal = useSessionStore((s) => s.progressTotal())
  const sessionObj = useSessionStore((s) => s.session)
  const recommendation = useSessionStore((s) => s.recommendation)
  const phase = useSessionStore((s) => s.phase)
  const join = useSessionStore((s) => s.join)
  const loadSession = useSessionStore((s) => s.load)
  const setSession = useSessionStore((s) => s.setSession)
  const currentUserId = useAuthStore((s) => s.user?.id ?? 1)

  // Live group chat: connect + join the selected room (no-op in mock mode).
  useSocket(groupId)
  const messages = useGroupChatStore(selectGroupMessages(groupId))
  const sendMessage = useGroupChatStore((s) => s.sendMessage)
  const startSession = useGroupChatStore((s) => s.startSession)
  const receiveHistory = useGroupChatStore((s) => s.receiveHistory)
  const receiveMessage = useGroupChatStore((s) => s.receiveMessage)
  const receiveSessionStart = useGroupChatStore((s) => s.receiveSessionStart)
  const setTyping = useGroupChatStore((s) => s.setTyping)
  const typers = useGroupChatStore(selectTypers(groupId))

  // Session-start is synced live via the socket. The store records, per group,
  // the message index where the card belongs (null = not started), so every
  // client shows the card inline at the same point. Broadcasts to the whole room.
  const sessionStartIndex = useGroupChatStore(selectSessionStartIndex(groupId))

  const groups = useGroupsStore((s) => s.groups)
  const loadGroups = useGroupsStore((s) => s.load)
  const group = groups.find((g) => g.id === groupId)
  const groupName = group?.name ?? 'Group'

  // Group-detail (edit) panel visibility.
  const [editing, setEditing] = useState(false)
  // Host pre-session setup modal.
  const [hostModalOpen, setHostModalOpen] = useState(false)

  useEffect(() => {
    // Mock mode seeds a demo session/roster (id 42) so the card renders offline.
    // In live mode the roster is populated when a session is created/adopted via
    // the socket, so we don't hit a real session id that the user may not be in.
    if (USE_MOCK && members.length === 0) void loadSession(42, currentUserId)
  }, [members.length, loadSession, currentUserId])

  useEffect(() => {
    // Mock demo bootstrap: the socket is disabled offline, so nothing seeds the
    // group chat or fires receiveSessionStart (which normally arrives from the
    // gateway). Seed the demo backlog once and place the session card inline —
    // Sophie's "started a session" — so the whole Join → session → results flow
    // is walkable without a backend. Live mode gets all of this from the socket.
    if (!USE_MOCK) return
    if (messages.length > 0) return
    const toWire = (m: { id: string; userId: number; text: string }) => ({
      id: m.id,
      groupId,
      userId: m.userId,
      name: MOCK_MEMBER_NAMES[m.userId] ?? null,
      text: m.text,
      at: new Date().toISOString(),
      type: 'text' as const,
    })
    // Seed the pre-session backlog, drop the session card at that point, then
    // append the post-start messages so the card lands inline between them.
    receiveHistory(groupId, MOCK_GROUP_MESSAGES.map(toWire))
    receiveSessionStart(groupId)
    MOCK_GROUP_MESSAGES_AFTER.forEach((m) => receiveMessage(toWire(m)))
  }, [groupId, messages.length, receiveHistory, receiveMessage, receiveSessionStart])

  const memberIds = members.map((m) => m.user_id)
  const total = progressTotal || members.length || 6

  // The card state is derived from SESSION STATE, not just the screen, so it
  // reflects reality regardless of how the user navigated here:
  //   complete → results exist / everyone finished / the host already closed the
  //     session. Shows the "Results" button and blocks re-joining (#7, #12).
  //   waiting  → this user finished but the group hasn't. Shows "Waiting for
  //     others" (#6).
  //   else     → the screen-derived state (continue if mid-session, else Join).
  const allDone = total > 0 && doneCount === total
  const isComplete = recommendation != null || allDone || sessionObj?.closed_at != null
  const iAmDone =
    phase === 'done' || members.find((m) => m.user_id === currentUserId)?.status === true
  const cardState = isComplete
    ? 'complete'
    : iAmDone
      ? 'waiting'
      : (CARD_STATE[screen] ?? 'not-joined')

  // Header "X members" reflects the real group membership from GET /api/groups
  // (member_count); falls back to the session total in mock mode, where
  // MOCK_GROUPS carry no member_count.
  const memberCount = group?.member_count ?? total

  // Host finished the pre-session modal: adopt the created session locally, then
  // broadcast session:start WITH its id so every member's client can adopt it and
  // share one countdown. The inline card appears via the server echo.
  const handleSessionCreated = (session: Session) => {
    setSession(session, currentUserId)
    startSession(groupId, session.id)
    // Live: the card appears via the server's session:start echo. Mock: the
    // socket is null, so drop the card inline locally.
    if (USE_MOCK) receiveSessionStart(groupId)
    setHostModalOpen(false)
  }

  const handleJoin = () => {
    join()
    go('agent-chat')
  }

  // After leaving, the group is gone from the (refreshed) list. Jump to the next
  // most-recent group, or the empty-groups screen when none remain.
  const handleLeft = () => {
    setEditing(false)
    const next = mostRecentGroup(useGroupsStore.getState().groups)
    if (next) {
      setGroup(next.id)
      go('group-chat')
    } else {
      go('empty-groups')
    }
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
                    name={nameForMember(id, members)}
                    size="sm"
                    colorClass={MOCK_MEMBER_COLORS[id]}
                    className="h-4 w-4 border border-surface-raised text-[7px]"
                  />
                ))}
              </div>
            </div>
            <p className="text-xs text-text-muted">
              {memberCount} members
              {/* "Session active" only while a live session is in progress — not
                  before one starts, and not once it's complete. */}
              {sessionStartIndex !== null && !isComplete && (
                <> · <span className="text-primary">session active</span></>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-input border border-border px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-sunken"
            >
              <Icon name="users" size={12} /> Edit group
            </button>
            {sessionStartIndex === null && (
              <button
                onClick={() => setHostModalOpen(true)}
                className="flex items-center gap-1.5 rounded-input bg-surface-inverse px-3 py-1.5 text-xs font-medium text-white"
              >
                <Icon name="sparkles" size={12} /> Start session
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          {/* Messages that existed before the session started */}
          {(sessionStartIndex === null ? messages : messages.slice(0, sessionStartIndex)).map((m) => (
            <GroupMessageRow key={m.id} message={m} currentUserId={currentUserId} />
          ))}

          {/* Session-started divider + card — inline at the point the user started it */}
          {sessionStartIndex !== null && (
            <>
              <div className="flex items-center gap-3 py-1 text-xs text-text-muted">
                <span className="h-px flex-1 bg-border" />
                {MOCK_MEMBER_NAMES[SESSION_STARTED_BY]} started a session
                <span className="h-px flex-1 bg-border" />
              </div>
              <SessionCard
                state={cardState}
                members={members}
                readyCount={cardState === 'complete' ? total : doneCount}
                total={total}
                onJoin={handleJoin}
                onContinue={() => go('agent-chat')}
                onViewResults={() => go('top-picks')}
              />

              {/* Messages that arrived after the session started */}
              {messages.slice(sessionStartIndex).map((m) => (
                <GroupMessageRow key={m.id} message={m} currentUserId={currentUserId} />
              ))}
            </>
          )}
        </div>

        {/* Live "… is typing" bubble, pinned just above the composer */}
        <TypingIndicator typers={typers} />

        {/* Composer — same reusable message bar as the agent chat */}
        <VoiceComposer
          onSend={(text) => sendMessage(groupId, text)}
          onTyping={(isTyping) => setTyping(groupId, isTyping)}
          placeholder="Message"
        />
      </div>

      {/* Group detail / edit panel (slides in from the right) */}
      <GroupDetailPanel
        key={groupId}
        open={editing}
        groupId={groupId}
        currentUserId={currentUserId}
        onClose={() => setEditing(false)}
        onMembersChanged={() => void loadGroups()}
        onLeft={handleLeft}
      />

      {/* Host pre-session setup */}
      <HostSessionModal
        open={hostModalOpen}
        groupId={groupId}
        onClose={() => setHostModalOpen(false)}
        onCreated={handleSessionCreated}
      />
    </div>
  )
}

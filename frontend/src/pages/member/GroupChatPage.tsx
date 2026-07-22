import { useState } from 'react'
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
import { memberColor } from '@/constants/memberColors'
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
  const setSession = useSessionStore((s) => s.setSession)
  const hydrateMembers = useSessionStore((s) => s.hydrateMembers)
  const startedAt = useSessionStore((s) => s.startedAt)
  const triggerExpiryGeneration = useSessionStore((s) => s.triggerExpiryGeneration)
  const currentUserId = useAuthStore((s) => s.user?.id ?? 0)

  // Live group chat: connect + join the selected room over the socket.
  useSocket(groupId)
  const messages = useGroupChatStore(selectGroupMessages(groupId))
  const sendMessage = useGroupChatStore((s) => s.sendMessage)
  const startSession = useGroupChatStore((s) => s.startSession)
  const clearSessionStart = useGroupChatStore((s) => s.clearSessionStart)
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

  const memberIds = members.map((m) => m.user_id)
  const total = progressTotal || members.length || 0

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

  // A session is "ongoing" once it has started but hasn't completed — the window
  // in which "Start session" is disabled (you can't run two at once). Once
  // complete (or none started), the button is clickable again so the group can
  // kick off another session in the same chat.
  const sessionOngoing = sessionStartIndex !== null && !isComplete

  // Header "X members" reflects the real group membership from GET /api/groups
  // (member_count); falls back to the session total when absent.
  const memberCount = group?.member_count ?? total

  // Host finished the pre-session modal: adopt the created session locally, then
  // broadcast session:start WITH its id so every member's client can adopt it and
  // share one countdown. The inline card appears via the server echo.
  const handleSessionCreated = (session: Session) => {
    // Clear any PRIOR session's card marker for this group first, so the new
    // session places a fresh card (receiveSessionStart dedupes while a marker
    // exists). setSession clears the prior session's results/roster in the
    // session store. Together these make "start another session" work after one
    // completes — otherwise the new session inherits the old card position and
    // stale picks.
    clearSessionStart(groupId)
    setSession(session, currentUserId)
    startSession(groupId, session.id)
    // The card appears via the server's session:start echo. The create response
    // has no member names, and the host skips the session:start load() — so fetch
    // the name-carrying roster now, else the host's own avatar/roster shows
    // "User N"/"U1".
    void hydrateMembers(session.id)
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
                    colorClass={memberColor(id)}
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
            {/* Start session stays PRESENT the whole time — it's only DISABLED
                while a session is actively running (started but not yet complete),
                and re-enables once results land / the session closes so the group
                can start another. Edit group is anchored to the far right. */}
            <button
              onClick={() => setHostModalOpen(true)}
              disabled={sessionOngoing}
              title={sessionOngoing ? 'A session is already in progress' : undefined}
              className="flex items-center gap-1.5 rounded-input bg-surface-inverse px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="sparkles" size={12} /> Start session
            </button>
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-input border border-border px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-sunken"
            >
              <Icon name="users" size={12} /> Edit group
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          {/* Messages that existed before the session started */}
          {(sessionStartIndex === null ? messages : messages.slice(0, sessionStartIndex)).map((m) => (
            <GroupMessageRow key={m.id} message={m} currentUserId={currentUserId} members={members} />
          ))}

          {/* Session-started divider + card — inline at the point the user started it */}
          {sessionStartIndex !== null && (
            <>
              <div className="flex items-center gap-3 py-1 text-xs text-text-muted">
                <span className="h-px flex-1 bg-border" />
                {nameForMember(sessionObj?.host_user_id ?? 0, members)} started a
                session
                <span className="h-px flex-1 bg-border" />
              </div>
              <SessionCard
                state={cardState}
                members={members}
                readyCount={cardState === 'complete' ? total : doneCount}
                total={total}
                startedAt={startedAt}
                minutes={sessionObj?.time_limit}
                onJoin={handleJoin}
                onContinue={() => go('agent-chat')}
                onViewResults={() => go('top-picks')}
                onExpire={() => void triggerExpiryGeneration()}
                onReview={() => go('agent-chat-done')}
              />

              {/* Messages that arrived after the session started */}
              {messages.slice(sessionStartIndex).map((m) => (
                <GroupMessageRow key={m.id} message={m} currentUserId={currentUserId} members={members} />
              ))}
            </>
          )}
        </div>

        {/* Live "… is typing" bubble, pinned just above the composer */}
        <TypingIndicator typers={typers} members={members} />

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

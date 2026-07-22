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
} from '@/api/mock/groupChatMock'
import { MOCK_MEMBER_COLORS, MOCK_MEMBER_NAMES } from '@/api/mock/sessionMock'
import { nameForMember } from '@/utils/memberName'
import {
  useSessionStore,
  selectMembers,
  selectDoneCount,
  selectProgressTotal,
  selectSession,
  selectActiveSessionId,
  selectRecommendation,
  selectPhase,
  selectStartedAt,
} from '@/stores/sessionStore'
import { fetchCurrentGroupSession } from '@/api/groupsApi'
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
  // Session state is keyed by group — read THIS group's slice via selectors.
  const members = useSessionStore(selectMembers(groupId))
  const doneCount = useSessionStore(selectDoneCount(groupId))
  const progressTotal = useSessionStore(selectProgressTotal(groupId))
  const sessionObj = useSessionStore(selectSession(groupId))
  const activeSessionId = useSessionStore(selectActiveSessionId(groupId))
  const recommendation = useSessionStore(selectRecommendation(groupId))
  const phase = useSessionStore(selectPhase(groupId))
  const startedAt = useSessionStore(selectStartedAt(groupId))
  const join = useSessionStore((s) => s.join)
  const loadSession = useSessionStore((s) => s.load)
  const loadRecommendation = useSessionStore((s) => s.loadRecommendation)
  const setSession = useSessionStore((s) => s.setSession)
  const hydrateMembers = useSessionStore((s) => s.hydrateMembers)
  const triggerExpiryGeneration = useSessionStore((s) => s.triggerExpiryGeneration)
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
    // `members` is now this group's own slice, so `members.length === 0` means
    // "this group has no session yet" — each mock group gets its own independent
    // copy of the demo session, so progress/results diverge per group. In live mode
    // the roster is populated when a session is created/adopted via the socket (or
    // rebound on reload, below), so we don't hit a session id the user isn't in.
    if (USE_MOCK && members.length === 0) {
      void loadSession(groupId, 42, currentUserId)
    }
  }, [members.length, loadSession, currentUserId, groupId])

  useEffect(() => {
    // Live-mode reload survival: on a fresh page load the socket `session:start`
    // was already missed and isn't replayed on join, so an in-progress session
    // would otherwise vanish. If THIS group's slice has no active session yet, ask
    // the gateway for the group's current OPEN session and rebind it — reusing the
    // same load()/loadRecommendation() the socket path uses, plus receiveSessionStart
    // so the inline card renders. Returns null (→ no-op) when the group has none.
    // The effect is keyed on activeSessionId, so once bound it won't re-fetch, and a
    // null result leaves the deps unchanged → no loop.
    if (USE_MOCK || activeSessionId != null) return
    let cancelled = false
    void (async () => {
      const session = await fetchCurrentGroupSession(groupId)
      if (cancelled || session == null) return
      await loadSession(groupId, session.id, currentUserId)
      // Place the inline card at the current end of the (reloaded) backlog.
      receiveSessionStart(groupId, session.id)
      // Pull any already-generated results so a completed session rebinds its card.
      void loadRecommendation(groupId)
    })()
    return () => {
      cancelled = true
    }
  }, [activeSessionId, groupId, currentUserId, loadSession, loadRecommendation, receiveSessionStart])

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
  // All reads above are THIS group's own slice (keyed store), so there is nothing
  // from another group to leak — no group gate needed.
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
    setSession(groupId, session, currentUserId)
    startSession(groupId, session.id)
    // Live: the card appears via the server's session:start echo. Mock: the
    // socket is null, so drop the card inline locally.
    if (USE_MOCK) receiveSessionStart(groupId)
    // Live: the create response has no member names, and the host skips the
    // session:start load() — so fetch the name-carrying roster now, else the
    // host's own avatar/roster shows "User N"/"U1".
    else void hydrateMembers(groupId, session.id)
    setHostModalOpen(false)
  }

  const handleJoin = () => {
    join(groupId)
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
            <GroupMessageRow key={m.id} message={m} currentUserId={currentUserId} members={members} />
          ))}

          {/* Session-started divider + card — inline at the point the user started
              it. `sessionStartIndex` is already per-group (groupChatStore), and the
              session state read above is this group's own slice, so the card only
              ever reflects THIS group's session. */}
          {sessionStartIndex !== null && (
            <>
              <div className="flex items-center gap-3 py-1 text-xs text-text-muted">
                <span className="h-px flex-1 bg-border" />
                {nameForMember(sessionObj?.host_user_id ?? SESSION_STARTED_BY, members)} started a
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
                onExpire={() => void triggerExpiryGeneration(groupId)}
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

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { Session } from '@/types'
import { EASE } from '@/lib/motion'
import { GroupsSidebar } from '@/components/session/GroupsSidebar'
import { GroupMessageRow } from '@/components/session/GroupMessageRow'
import { SessionCard } from '@/components/session/SessionCard'
import { GroupDetailPanel } from '@/components/session/GroupDetailPanel'
import { HostSessionModal } from '@/components/session/HostSessionModal'
import { Avatar, Icon, Spinner } from '@/components/ui'
import { COLUMN_HEADER_H } from '@/components/layout/AppSidebar'
import { VoiceComposer } from '@/components/voice/VoiceComposer'
import { TypingIndicator } from '@/components/session/TypingIndicator'
import { cn } from '@/utils/cn'
import { USE_MOCK } from '@/lib/env'
import { SESSION_STARTED_BY } from '@/api/mock/groupChat.mock'
import { MOCK_MEMBER_COLORS, MOCK_MEMBER_NAMES } from '@/api/mock/session.mock'
import { useSessionStore } from '@/stores/sessionStore'
import { useAuthStore } from '@/stores/authStore'
import { useNavStore } from '@/stores/navStore'
import { useGroupsStore, mostRecentGroup } from '@/stores/groupsStore'
import {
  useGroupChatStore,
  selectGroupMessages,
  selectHistoryLoaded,
  selectSessionStartIndex,
  selectTypers,
} from '@/stores/groupChatStore'
import { useSocket } from '@/hooks/useSocket'
import { useScrollToBottom } from '@/hooks/useScrollToBottom'
import { useNewItemIds } from '@/hooks/useNewItemIds'

// Card state derives from which group-chat screen we're on.
const CARD_STATE: Record<string, 'not-joined' | 'continue' | 'waiting' | 'complete'> = {
  'group-chat': 'not-joined',
  'session-continue': 'continue',
  'session-waiting': 'waiting',
  'session-complete': 'complete',
}

export function GroupChatPage() {
  const reduce = useReducedMotion()
  const screen = useNavStore((s) => s.screen)
  const go = useNavStore((s) => s.go)
  const setGroup = useNavStore((s) => s.setGroup)
  const groupId = useNavStore((s) => s.groupId)
  const members = useSessionStore((s) => s.members)
  const doneCount = useSessionStore((s) => s.doneCount())
  const join = useSessionStore((s) => s.join)
  const loadSession = useSessionStore((s) => s.load)
  const setSession = useSessionStore((s) => s.setSession)
  const currentUserId = useAuthStore((s) => s.user?.id ?? 1)

  // Resolve membership BEFORE connecting the socket, so we never join a room the
  // user isn't in. In mock mode every seeded group is "yours"; in live mode a
  // group counts only if it's in the loaded list. groupId 0 is the no-group
  // sentinel (see navStore).
  const groups = useGroupsStore((s) => s.groups)
  const groupsLoaded = useGroupsStore((s) => s.loaded)
  const loadGroups = useGroupsStore((s) => s.load)
  const group = groups.find((g) => g.id === groupId)
  const groupName = group?.name ?? 'Group'
  const isMember = USE_MOCK || (groupId > 0 && !!group)

  // Live group chat: connect + join the selected room (no-op in mock mode). Only
  // join a room the user actually belongs to — pass 0 otherwise (useSocket skips
  // the join for a non-positive id).
  useSocket(isMember ? groupId : 0)
  const messages = useGroupChatStore(selectGroupMessages(groupId))
  const historyLoaded = useGroupChatStore(selectHistoryLoaded(groupId))
  const sendMessage = useGroupChatStore((s) => s.sendMessage)
  const startSession = useGroupChatStore((s) => s.startSession)
  const setTyping = useGroupChatStore((s) => s.setTyping)
  const typers = useGroupChatStore(selectTypers(groupId))

  // Session-start is synced live via the socket. The store records, per group,
  // the message index where the card belongs (null = not started), so every
  // client shows the card inline at the same point. Broadcasts to the whole room.
  const sessionStartIndex = useGroupChatStore(selectSessionStartIndex(groupId))

  // Auto-scroll to newest. Opening a chat (or switching groups via the groupId
  // reset key, or the initial socket history bulk-load) jumps to the bottom
  // instantly; a single new message (echo lands, +1) smooth-scrolls into view.
  // Fold the typing bubble into the count so it nudges the view when it appears.
  const endRef = useScrollToBottom<HTMLDivElement>(messages.length + typers.length, groupId)
  // Only messages that just arrived pop in; opening/switching a group renders the
  // existing history static (keyed by groupId so a switch resets the "seen" set).
  const newIds = useNewItemIds(messages.map((m) => m.id), groupId)

  // Group-detail (edit) panel visibility.
  const [editing, setEditing] = useState(false)
  // Host pre-session setup modal.
  const [hostModalOpen, setHostModalOpen] = useState(false)

  // Redirect a user who has no valid selected group to the empty-groups screen —
  // but only once the list has loaded, so an in-flight/empty list doesn't bounce
  // a valid member off their chat.
  useEffect(() => {
    if (groupsLoaded && !isMember) go('empty-groups')
  }, [groupsLoaded, isMember, go])

  useEffect(() => {
    // Mock mode seeds a demo session/roster (id 42) so the card renders offline.
    // In live mode the roster is populated when a session is created/adopted via
    // the socket, so we don't hit a real session id that the user may not be in.
    if (USE_MOCK && members.length === 0) void loadSession(42, currentUserId)
  }, [members.length, loadSession, currentUserId])

  // History loads async over the socket (chat:history) after joining. Show a
  // loader until it arrives. Mock mode has no socket / no history event, so it's
  // never "loading" there (messages appear as they're seeded locally).
  const loadingHistory = !USE_MOCK && isMember && groupId > 0 && !historyLoaded

  const cardState = CARD_STATE[screen] ?? 'not-joined'
  const memberIds = members.map((m) => m.user_id)
  const total = members.length || 6
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

  // Paint guard (after all hooks): don't render group 7 / a foreign room for the
  // frame before the redirect effect fires.
  if (!isMember) return null

  return (
    <div className="flex h-screen overflow-hidden bg-surface-raised">
      <GroupsSidebar />

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {/* Header — same height as sidebar/right-panel headers for seamless borders */}
        <div className={cn('flex items-center justify-between border-b border-border px-5', COLUMN_HEADER_H)}>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-item-title font-bold text-text">{groupName}</span>
              {/* Overlapping member stack — a newly added member pops into the
                  cluster (spring scale-in) when the roster grows. */}
              <div className="flex -space-x-1.5">
                <AnimatePresence initial={false}>
                  {memberIds.slice(0, 5).map((id) => (
                    <motion.span
                      key={id}
                      layout={!reduce}
                      initial={{ opacity: 0, scale: reduce ? 1 : 0.4 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: reduce ? 1 : 0.4 }}
                      transition={
                        reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 520, damping: 26 }
                      }
                    >
                      <Avatar
                        name={MOCK_MEMBER_NAMES[id] ?? '?'}
                        size="sm"
                        colorClass={MOCK_MEMBER_COLORS[id]}
                        className="h-4 w-4 border border-surface-raised text-[7px]"
                      />
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
            </div>
            <p className="text-caption text-text-muted">
              {memberCount} members · <span className="text-primary">session active</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-input border border-border px-3 py-1.5 text-caption font-medium text-text hover:bg-surface-sunken"
            >
              <Icon name="users" size={12} /> Edit group
            </button>
            {sessionStartIndex === null && (
              <button
                onClick={() => setHostModalOpen(true)}
                className="flex items-center gap-1.5 rounded-input bg-surface-inverse px-3 py-1.5 text-caption font-medium text-white"
              >
                <Icon name="sparkles" size={12} /> Start session
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          {loadingHistory ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-text-muted">
              <Spinner size="md" />
              <span className="text-caption">Loading messages…</span>
            </div>
          ) : (
          <>
          {/* Messages that existed before the session started */}
          {(sessionStartIndex === null ? messages : messages.slice(0, sessionStartIndex)).map((m) => (
            <GroupMessageRow key={m.id} message={m} currentUserId={currentUserId} isNew={newIds.has(m.id)} />
          ))}

          {/* Session-started divider + card — inline at the point the user started it */}
          {sessionStartIndex !== null && (
            <>
              {/* The session announcement rises into the transcript like a message. */}
              <motion.div
                className="flex flex-col gap-3"
                initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0.2 : 0.3, ease: EASE }}
              >
                <div className="flex items-center gap-3 py-1 text-caption text-text-muted">
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
              </motion.div>

              {/* Messages that arrived after the session started */}
              {messages.slice(sessionStartIndex).map((m) => (
                <GroupMessageRow key={m.id} message={m} currentUserId={currentUserId} isNew={newIds.has(m.id)} />
              ))}
            </>
          )}
          </>
          )}
          <div ref={endRef} />
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

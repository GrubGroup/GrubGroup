import { useEffect, useState } from 'react'
import { GroupsSidebar } from '@/components/session/GroupsSidebar'
import { ChatStream } from '@/components/session/ChatStream'
import { GroupProgressPanel } from '@/components/session/GroupProgressPanel'
import { NotedSoFarPanel } from '@/components/session/NotedSoFarPanel'
import { SessionTopBar } from '@/components/session/SessionTopBar'
import { VoiceComposer } from '@/components/voice/VoiceComposer'
import { Button, Icon, Spinner } from '@/components/ui'
import { COLUMN_HEADER_H } from '@/components/layout/AppSidebar'
import { cn } from '@/utils/cn'
import { USE_MOCK } from '@/lib/env'
import {
  useChatStore,
  selectChatMessages,
  selectChatSessionId,
  selectSending,
  selectMissingSignals,
} from '@/stores/chatStore'
import {
  useSessionStore,
  selectPhase,
  selectMembers,
  selectDoneCount,
  selectProgressTotal,
  selectRecommendation,
  selectActiveSessionId,
} from '@/stores/sessionStore'
import { useAuthStore } from '@/stores/authStore'
import { useNavStore } from '@/stores/navStore'
import { useSocket } from '@/hooks/useSocket'
import { setReady } from '@/api/sessionApi'
import { chipsForMissing } from '@/constants/agentChat'

export function AgentChatPage() {
  const screen = useNavStore((s) => s.screen)
  const groupId = useNavStore((s) => s.groupId)
  const go = useNavStore((s) => s.go)

  // Agent-chat transcript is keyed by group — read THIS group's slice.
  const messages = useChatStore(selectChatMessages(groupId))
  const seed = useChatStore((s) => s.seed)
  const chatSessionId = useChatStore(selectChatSessionId(groupId))
  const sendUserMessage = useChatStore((s) => s.sendUserMessage)
  const adoptSessionId = useChatStore((s) => s.adoptSessionId)
  const sending = useChatStore(selectSending(groupId))
  const missingSignals = useChatStore(selectMissingSignals(groupId))

  // Session state is keyed by group too.
  const phase = useSessionStore(selectPhase(groupId))
  const setPhase = useSessionStore((s) => s.setPhase)
  const setMemberDone = useSessionStore((s) => s.setMemberDone)
  const simulateAutoComplete = useSessionStore((s) => s.simulateAutoComplete)
  const members = useSessionStore(selectMembers(groupId))
  const doneCount = useSessionStore(selectDoneCount(groupId))
  const progressTotal = useSessionStore(selectProgressTotal(groupId))
  const recommendation = useSessionStore(selectRecommendation(groupId))
  const activeSessionId = useSessionStore(selectActiveSessionId(groupId))
  const loadSession = useSessionStore((s) => s.load)
  const currentUserId = useAuthStore((s) => s.user?.id ?? 1)
  const displayName = useAuthStore((s) => s.user?.display_name ?? s.user?.username ?? null)

  // Quick-reply chips follow the question the agent just asked (its first
  // still-missing signal), mirroring interactive_session.py's per-question chips.
  // Before the first turn (nothing asked/missing yet) show the cuisine chips —
  // the opening greeting asks about preferred cuisines first.
  const quickReplies = chipsForMissing(
    missingSignals.length ? missingSignals : ['preferred_cuisines'],
  )

  // Keep the live socket subscribed while the member chats, so session:member_done
  // progress + a session:picks delivery still update this page (the group-chat page
  // is unmounted here). The singleton socket makes the room join idempotent.
  useSocket(groupId)

  useEffect(() => {
    // Mock mode seeds the demo roster; live adopts the session via the socket.
    if (USE_MOCK && members.length === 0) void loadSession(groupId, 42, currentUserId)

    // Seed the conversation when there's none yet, or re-seed when it belongs to
    // a GENUINELY DIFFERENT session — so a new session never inherits the prior
    // transcript. Refining an unknown id into the real one (chatSessionId null →
    // activeSessionId concrete) is NOT a session change: adopt the id onto the
    // in-progress transcript instead of re-seeding, so a turn sent during that
    // window is never wiped. All chat reads/writes are scoped to THIS group's
    // transcript, so switching groups preserves each group's own conversation.
    const isDifferentSession =
      chatSessionId != null && activeSessionId != null && chatSessionId !== activeSessionId
    if (messages.length === 0 || isDifferentSession) {
      seed(groupId, activeSessionId, displayName)
    } else if (chatSessionId == null && activeSessionId != null) {
      adoptSessionId(groupId, activeSessionId)
    }
    if (phase === 'joining' || phase === 'waiting') setPhase(groupId, 'chatting')
  }, [
    members.length,
    loadSession,
    currentUserId,
    groupId,
    displayName,
    messages.length,
    chatSessionId,
    activeSessionId,
    seed,
    adoptSessionId,
    phase,
    setPhase,
  ])

  // The conversation ALWAYS stays visible (matches wireframe). Only the bottom
  // bar changes: composer → done pill. 'agent-chat-done' shows the pill.
  const isDone = screen === 'agent-chat-done'
  const [marking, setMarking] = useState(false)

  const handleSend = (text: string) => void sendUserMessage(groupId, text, activeSessionId)

  const handleDone = async () => {
    if (marking) return // guard against a double-click during the REST round-trip
    setMarking(true)
    // Live: mark ready over REST — the gateway broadcasts session:member_done and
    // (when this is the last finish) auto-generates results, which arrive via
    // session:picks. Every client reconciles from the echo. Mock: flip locally.
    if (USE_MOCK || activeSessionId == null) {
      setMemberDone(groupId, currentUserId)
      // Mock demo: the socket is disabled, so nothing drives the other members to
      // finish. Stand in for the gateway's auto-complete — after a short beat the
      // remaining members "finish" and results appear, so the waiting state is
      // shown briefly and then the Results affordance lights up.
      if (USE_MOCK) {
        const allOthersDone = (useSessionStore.getState().byGroup[groupId]?.members ?? [])
          .filter((m) => m.user_id !== currentUserId)
          .every((m) => m.status)
        if (allOthersDone) {
          simulateAutoComplete(groupId)
        } else {
          setTimeout(() => simulateAutoComplete(groupId), 2500)
        }
      }
    } else {
      try {
        await setReady(activeSessionId, true)
      } catch {
        // Even if the REST call fails, advance this user's own UI so they aren't
        // stuck; the broadcast reconciles the shared roster when it lands.
        setMemberDone(groupId, currentUserId)
      }
    }
    go('agent-chat-done')
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface">
      {/* Full-width session bar: "Your food agent" + live countdown (center) */}
      <SessionTopBar groupId={groupId} />

      <div className="flex flex-1 overflow-hidden">
        <GroupsSidebar />

        {/* Center: chat (always visible) */}
        <div className="flex flex-1 flex-col">
          {/* Dark chat header — matches column header height */}
          <div className={cn('flex items-center gap-3 bg-surface-inverse px-4', COLUMN_HEADER_H)}>
            <button
              onClick={() => go('group-chat')}
              className="flex h-8 w-8 items-center justify-center rounded-pill text-white/80 hover:bg-white/10"
            >
              <Icon name="chevron-left" size={18} />
            </button>
            <div>
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/50">
                <Icon name="lock" size={10} /> Private · only you can see this
              </p>
              <p className="text-sm font-semibold text-white">Your food agent</p>
            </div>
          </div>

          {/* Conversation always visible; the done pill renders in-stream. */}
          <ChatStream done={isDone} groupId={groupId} />

          {!isDone ? (
            <>
              {/* Quick-reply chips — follow the question the agent just asked. */}
              {quickReplies.length > 0 && (
                <div className="flex flex-wrap gap-2 px-5 pb-1 pt-2">
                  {quickReplies.map((q) => (
                    <button
                      key={q}
                      disabled={sending}
                      onClick={() => handleSend(q)}
                      className="rounded-pill border border-border-strong bg-surface-raised px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-sunken disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
              <VoiceComposer onSend={handleSend} disabled={sending} privacyNote />
              {/* Prominent finish CTA — the primary way to end the conversation. */}
              <div className="border-t border-border bg-surface-raised p-4">
                <Button
                  fullWidth
                  size="lg"
                  variant="primary"
                  isLoading={marking}
                  rightIcon={<Icon name="arrow-right" size={16} />}
                  onClick={() => void handleDone()}
                >
                  I'm Finished
                </Button>
              </div>
            </>
          ) : (
            // Done: the conversation + noted panel stay visible for review. The
            // footer shows a waiting state until the group's results are ready,
            // then a prominent way into them.
            <div className="border-t border-border bg-surface-raised p-4">
              {recommendation != null ? (
                <Button
                  fullWidth
                  size="lg"
                  variant="accent"
                  rightIcon={<Icon name="arrow-right" size={16} />}
                  onClick={() => go('top-picks')}
                >
                  See the group's results
                </Button>
              ) : (
                <div className="flex flex-col items-center gap-1 py-1 text-center">
                  <span className="flex items-center gap-2 text-sm font-medium text-text">
                    <Spinner size="sm" /> Waiting for others
                  </span>
                  <span className="text-xs text-text-muted">
                    {doneCount} of {progressTotal} finished · you can review your
                    answers while you wait
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: progress + noted */}
        <aside className="flex w-60 shrink-0 flex-col border-l border-border bg-surface-panel">
          <div className={cn('flex flex-col justify-center border-b border-border px-4', COLUMN_HEADER_H)}>
            <GroupProgressPanel headerOnly groupId={groupId} />
          </div>
          <div className="flex flex-col gap-5 overflow-y-auto p-4">
            <GroupProgressPanel rosterOnly groupId={groupId} />
            <NotedSoFarPanel groupId={groupId} />
          </div>
        </aside>
      </div>
    </div>
  )
}

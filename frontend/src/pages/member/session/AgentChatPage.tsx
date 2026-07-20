import { useEffect, useState } from 'react'
import { GroupsSidebar } from '@/components/session/GroupsSidebar'
import { ChatStream } from '@/components/session/ChatStream'
import { GroupProgressPanel } from '@/components/session/GroupProgressPanel'
import { NotedSoFarPanel } from '@/components/session/NotedSoFarPanel'
import { SessionTopBar } from '@/components/session/SessionTopBar'
import { VoiceComposer } from '@/components/voice/VoiceComposer'
import { Icon } from '@/components/ui'
import { COLUMN_HEADER_H } from '@/components/layout/AppSidebar'
import { cn } from '@/utils/cn'
import { USE_MOCK } from '@/lib/env'
import { useChatStore } from '@/stores/chatStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useAuthStore } from '@/stores/authStore'
import { useNavStore } from '@/stores/navStore'
import { useSocket } from '@/hooks/useSocket'
import { setReady } from '@/api/session.api'
import { chipsForMissing } from '@/constants/agentChat'

export function AgentChatPage() {
  const messages = useChatStore((s) => s.messages)
  const seed = useChatStore((s) => s.seed)
  const chatSessionId = useChatStore((s) => s.sessionId)
  const sendUserMessage = useChatStore((s) => s.sendUserMessage)
  const adoptSessionId = useChatStore((s) => s.adoptSessionId)
  const sending = useChatStore((s) => s.sending)
  const missingSignals = useChatStore((s) => s.missingSignals)

  const phase = useSessionStore((s) => s.phase)
  const setPhase = useSessionStore((s) => s.setPhase)
  const setMemberDone = useSessionStore((s) => s.setMemberDone)
  const members = useSessionStore((s) => s.members)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const loadSession = useSessionStore((s) => s.load)
  const currentUserId = useAuthStore((s) => s.user?.id ?? 1)
  const displayName = useAuthStore((s) => s.user?.display_name ?? s.user?.username ?? null)
  const screen = useNavStore((s) => s.screen)
  const groupId = useNavStore((s) => s.groupId)
  const go = useNavStore((s) => s.go)

  // Quick-reply chips follow the question the agent just asked (its first
  // still-missing signal), mirroring interactive_session.py's per-question chips.
  // Before the first turn (nothing asked/missing yet) show the dietary chips —
  // the opening greeting asks about dietary needs first.
  const quickReplies = chipsForMissing(
    missingSignals.length ? missingSignals : ['dietary_restrictions'],
  )

  // Keep the live socket subscribed while the member chats, so session:member_done
  // progress + a session:picks delivery still update this page (the group-chat page
  // is unmounted here). The singleton socket makes the room join idempotent.
  useSocket(groupId)

  useEffect(() => {
    // Mock mode seeds the demo roster; live adopts the session via the socket.
    if (USE_MOCK && members.length === 0) void loadSession(42, currentUserId)

    // Seed the conversation when there's none yet, or re-seed when it belongs to
    // a GENUINELY DIFFERENT session — so a new session never inherits the prior
    // transcript. Refining an unknown id into the real one (chatSessionId null →
    // activeSessionId concrete) is NOT a session change: adopt the id onto the
    // in-progress transcript instead of re-seeding, so a turn sent during that
    // window is never wiped.
    const isDifferentSession =
      chatSessionId != null && activeSessionId != null && chatSessionId !== activeSessionId
    if (messages.length === 0 || isDifferentSession) {
      seed(activeSessionId, displayName)
    } else if (chatSessionId == null && activeSessionId != null) {
      adoptSessionId(activeSessionId)
    }
    if (phase === 'joining' || phase === 'waiting') setPhase('chatting')
  }, [
    members.length,
    loadSession,
    currentUserId,
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

  const handleSend = (text: string) => void sendUserMessage(text, activeSessionId)

  const handleDone = async () => {
    if (marking) return // guard against a double-click during the REST round-trip
    setMarking(true)
    // Live: mark ready over REST — the gateway broadcasts session:member_done and
    // every client (incl. this one) reconciles from the echo. Mock: flip locally.
    if (USE_MOCK || activeSessionId == null) {
      setMemberDone(currentUserId)
    } else {
      try {
        await setReady(activeSessionId, true)
      } catch {
        // Even if the REST call fails, advance this user's own UI so they aren't
        // stuck; the broadcast reconciles the shared roster when it lands.
        setMemberDone(currentUserId)
      }
    }
    go('agent-chat-done')
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface">
      {/* Full-width session bar: "Your food agent" + live countdown (center) */}
      <SessionTopBar />

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
          <ChatStream done={isDone} />

          {!isDone && (
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
              <button
                onClick={() => void handleDone()}
                disabled={marking}
                className="flex items-center justify-center gap-1 border-t border-border bg-surface-raised py-2 text-center text-xs font-medium text-primary hover:text-primary-hover disabled:opacity-50"
              >
                I'm done sharing preferences <Icon name="arrow-right" size={12} />
              </button>
            </>
          )}
        </div>

        {/* Right: progress + noted */}
        <aside className="flex w-60 shrink-0 flex-col border-l border-border bg-surface-panel">
          <div className={cn('flex flex-col justify-center border-b border-border px-4', COLUMN_HEADER_H)}>
            <GroupProgressPanel headerOnly />
          </div>
          <div className="flex flex-col gap-5 overflow-y-auto p-4">
            <GroupProgressPanel rosterOnly />
            <NotedSoFarPanel />
          </div>
        </aside>
      </div>
    </div>
  )
}

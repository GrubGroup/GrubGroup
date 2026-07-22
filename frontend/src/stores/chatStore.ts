import { create } from 'zustand'
import type { ChatMessage, ConversationTurn, ExtractedSignals } from '@/types'
import { openingAgentMessage } from '@/constants/agentChat'
import { analyzeTurn } from '@/api/sessionApi'

interface ChatState {
  messages: ChatMessage[]
  // The session this transcript/signal-set belongs to. Used to re-seed when the
  // active session changes, so session B never inherits session A's chat.
  sessionId: number | null
  // The reconciled signal set the agent has accumulated across turns — sent back
  // on each turn so corrections work, and rendered in the "Noted so far" panel
  // (NotedSoFarPanel derives its rows from currentSignals + missingSignals).
  currentSignals: ExtractedSignals
  missingSignals: string[]
  // Authoritative "agent has everything it needs" flag from the analyze response
  // (server-derived). Drives the "all set" banner + finish CTA state. Distinct
  // from missingSignals being empty pre-first-turn: only true after a real turn.
  isComplete: boolean
  sending: boolean
  // Reset the conversation for a (possibly new) session. Opens with a single
  // agent greeting that asks the first question (dietary); everything after is
  // agent-reply-driven by the analyze round-trip. Records the sessionId so the
  // page can detect a stale transcript and re-seed. `displayName` personalizes
  // the greeting ("Hi Dev!").
  seed: (sessionId?: number | null, displayName?: string | null) => void
  // Attach the now-known session id to the CURRENT transcript WITHOUT wiping it.
  // Used when the active session id resolves (null → concrete) after seed already
  // ran — so refining an unknown id into the real one never re-seeds and drops an
  // in-progress conversation (only a genuinely different session id re-seeds).
  adoptSessionId: (sessionId: number) => void
  // Send one member turn to the QA sub-agent (analyze). Async: appends the user
  // message immediately, then the agent reply when it returns. `sessionId` is the
  // live session; null falls back to the mock/canned path.
  sendUserMessage: (text: string, sessionId: number | null) => Promise<void>
}

let idCounter = 100
const nextId = () => `m${++idCounter}`

const emptySignals = (): ExtractedSignals => ({
  dietary_restrictions: [],
  preferred_cuisines: [],
  disliked_cuisines: [],
  budget_min: null,
  budget_max: null,
  occasion: null,
  location_mode: null,
  location_label: null,
  location_lat: null,
  location_lon: null,
  radius_miles: null,
})

// Build the conversation_history the analyze endpoint replays for context, from
// the rendered messages (system lines dropped; agent -> assistant).
function toConversationHistory(messages: ChatMessage[]): ConversationTurn[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'agent')
    .map((m) => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.text }))
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  sessionId: null,
  currentSignals: emptySignals(),
  missingSignals: [],
  isComplete: false,
  sending: false,

  seed: (sessionId = null, displayName = null) => {
    // The conversation always opens with the agent's greeting, which asks the
    // FIRST question (dietary). No canned user turn, no pre-filled noted prefs —
    // signals accumulate only from real analyze replies as the member answers.
    const opening: ChatMessage = {
      id: nextId(),
      role: 'agent',
      text: openingAgentMessage(displayName),
      at: new Date().toISOString(),
    }
    set({
      messages: [opening],
      sessionId,
      currentSignals: emptySignals(),
      missingSignals: [],
      isComplete: false,
    })
  },

  adoptSessionId: (sessionId) => {
    // Only stamp it on — never touch messages/signals. No-op if unchanged.
    if (get().sessionId !== sessionId) set({ sessionId })
  },

  sendUserMessage: async (text, sessionId) => {
    const trimmed = text.trim()
    if (!trimmed || get().sending) return

    const userMsg: ChatMessage = {
      id: nextId(),
      role: 'user',
      text: trimmed,
      at: new Date().toISOString(),
    }
    const history = toConversationHistory(get().messages)
    set((s) => ({ messages: [...s.messages, userMsg], sending: true }))

    try {
      // The gateway derives host-ness server-side from session.host_user_id.
      const res = await analyzeTurn(sessionId ?? 0, {
        message: trimmed,
        message_source: 'text',
        conversation_history: history,
        current_signals: get().currentSignals,
      })
      const agentMsg: ChatMessage = {
        id: nextId(),
        role: 'agent',
        text: res.agent_reply,
        at: new Date().toISOString(),
      }
      set((s) => ({
        messages: [...s.messages, agentMsg],
        currentSignals: res.extracted_signals,
        missingSignals: res.missing_signals,
        // Prefer the server's authoritative flag; fall back to the missing list
        // being empty for an older gateway/ai_service that omits is_complete.
        isComplete: res.is_complete ?? res.missing_signals.length === 0,
        sending: false,
      }))
    } catch {
      // The analyze round-trip failed (network / gateway / ai_service / LLM). Keep
      // the prior signals untouched — the answer wasn't processed — and surface an
      // HONEST error rather than a fake agent acknowledgement. A `system` line
      // renders as a distinct centered notice (ChatMessage), so it's visibly an
      // error, NOT the agent moving on; and system lines are excluded from
      // toConversationHistory, so a retry re-asks the SAME question cleanly instead
      // of appearing to have been answered. Composer re-enables (sending:false).
      const errorNotice: ChatMessage = {
        id: nextId(),
        role: 'system',
        text: "Couldn't reach your food agent — check your connection and try again.",
        at: new Date().toISOString(),
      }
      set((s) => ({ messages: [...s.messages, errorNotice], sending: false }))
    }
  },
}))

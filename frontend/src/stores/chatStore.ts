import { create } from 'zustand'
import type { ChatMessage, ConversationTurn, ExtractedSignals, NotedPref } from '@/types'
import { openingAgentMessage } from '@/constants/agentChat'
import { analyzeTurn } from '@/api/sessionApi'

// The per-group agent-chat slice. Keyed by GROUP (not sessionId) so two groups'
// transcripts coexist: entering group B no longer wipes group A's in-progress
// conversation, and returning to A shows it intact. (Keying by sessionId would
// re-leak in mock, where every group shares MOCK_SESSION.id === 42.) Mirrors the
// keyed pattern of sessionStore/groupChatStore.
export interface ChatSlice {
  messages: ChatMessage[]
  notedPreferences: NotedPref[]
  // The session this transcript/signal-set belongs to. Used to re-seed when the
  // active session changes, so session B never inherits session A's chat.
  sessionId: number | null
  // The reconciled signal set the agent has accumulated across turns — sent back
  // on each turn so corrections work, and rendered in the "Noted so far" panel.
  currentSignals: ExtractedSignals
  missingSignals: string[]
  sending: boolean
}

// Declared BEFORE makeChatSlice: makeChatSlice() calls it, and EMPTY_CHAT_SLICE
// invokes makeChatSlice() at module-eval time — so emptySignals must already be
// initialized by then (a later `const` would throw a TDZ ReferenceError on import
// and blank the whole app).
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

const makeChatSlice = (): ChatSlice => ({
  messages: [],
  notedPreferences: [],
  sessionId: null,
  currentSignals: emptySignals(),
  missingSignals: [],
  sending: false,
})

// Stable frozen default returned by selectors for a group with no transcript yet,
// so an absent-group read never yields a fresh object (React 19 StrictMode loop).
const EMPTY_CHAT_SLICE: ChatSlice = Object.freeze(makeChatSlice())

interface ChatState {
  byGroup: Record<number, ChatSlice>
  // Reset the conversation for a group's (possibly new) session. Opens with a
  // single agent greeting that asks the first question (dietary); everything after
  // is agent-reply-driven by the analyze round-trip. Records the sessionId so the
  // page can detect a stale transcript and re-seed. `displayName` personalizes the
  // greeting ("Hi Dev!").
  seed: (groupId: number, sessionId?: number | null, displayName?: string | null) => void
  // Attach the now-known session id to a group's CURRENT transcript WITHOUT wiping
  // it. Used when the active session id resolves (null → concrete) after seed
  // already ran — so refining an unknown id into the real one never re-seeds and
  // drops an in-progress conversation (only a genuinely different session re-seeds).
  adoptSessionId: (groupId: number, sessionId: number) => void
  // Send one member turn to the QA sub-agent (analyze). Async: appends the user
  // message immediately, then the agent reply when it returns — always to the
  // ORIGIN group's slice, even if the user switched groups mid-round-trip.
  // `sessionId` is the live session; null falls back to the mock/canned path.
  sendUserMessage: (groupId: number, text: string, sessionId: number | null) => Promise<void>
}

let idCounter = 100
const nextId = () => `m${++idCounter}`

// Map reconciled signals + what's still missing into the "Noted so far" chips.
// A field is `confirmed` once the agent stopped listing it as missing.
function signalsToNotedPrefs(sig: ExtractedSignals, missing: string[]): NotedPref[] {
  const prefs: NotedPref[] = []
  const isMissing = (key: string) => missing.includes(key)

  // A field is `confirmed` once the agent stopped listing it in missing_signals.
  // These keys match the backend's ask-order names exactly (dietary_restrictions
  // / preferred_cuisines / disliked_cuisines / budget / location).
  if (sig.dietary_restrictions.length) {
    prefs.push({
      id: 'diet',
      label: sig.dietary_restrictions.join(', '),
      confirmed: !isMissing('dietary_restrictions'),
    })
  }
  if (sig.preferred_cuisines.length) {
    prefs.push({
      id: 'likes',
      label: `Likes: ${sig.preferred_cuisines.slice(0, 4).join(', ')}`,
      confirmed: !isMissing('preferred_cuisines'),
    })
  }
  if (sig.disliked_cuisines.length) {
    prefs.push({
      id: 'avoids',
      label: `Avoids: ${sig.disliked_cuisines.slice(0, 4).join(', ')}`,
      confirmed: !isMissing('disliked_cuisines'),
    })
  }
  if (sig.budget_min != null || sig.budget_max != null) {
    const label =
      sig.budget_min != null && sig.budget_max != null
        ? `$${sig.budget_min}–${sig.budget_max}pp`
        : sig.budget_max != null
          ? `Up to $${sig.budget_max}pp`
          : `From $${sig.budget_min}pp`
    prefs.push({ id: 'budget', label, confirmed: !isMissing('budget') })
  }
  if (sig.location_label) {
    prefs.push({
      id: 'location',
      label: sig.location_label,
      confirmed: !isMissing('location'),
    })
  }
  return prefs
}

// Build the conversation_history the analyze endpoint replays for context, from
// the rendered messages (system lines dropped; agent -> assistant).
function toConversationHistory(messages: ChatMessage[]): ConversationTurn[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'agent')
    .map((m) => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.text }))
}

export const useChatStore = create<ChatState>((set, get) => {
  // Read a group's transcript slice (never mutate through this).
  const slice = (groupId: number): ChatSlice => get().byGroup[groupId] ?? EMPTY_CHAT_SLICE

  // Immutably patch ONE group's transcript, lazily seeding from makeChatSlice() so
  // a group's first write can't crash on an absent slice. Other groups untouched.
  const patchChat = (
    groupId: number,
    patchOrFn: Partial<ChatSlice> | ((prev: ChatSlice) => Partial<ChatSlice>),
  ) =>
    set((s) => {
      const prev = s.byGroup[groupId] ?? makeChatSlice()
      const next = typeof patchOrFn === 'function' ? patchOrFn(prev) : patchOrFn
      return { byGroup: { ...s.byGroup, [groupId]: { ...prev, ...next } } }
    })

  return {
    byGroup: {},

    seed: (groupId, sessionId = null, displayName = null) => {
      // The conversation always opens with the agent's greeting, which asks the
      // FIRST question (dietary). No canned user turn, no pre-filled noted prefs —
      // signals accumulate only from real analyze replies as the member answers.
      const opening: ChatMessage = {
        id: nextId(),
        role: 'agent',
        text: openingAgentMessage(displayName),
        at: new Date().toISOString(),
      }
      patchChat(groupId, {
        messages: [opening],
        notedPreferences: [],
        sessionId,
        currentSignals: emptySignals(),
        missingSignals: [],
      })
    },

    adoptSessionId: (groupId, sessionId) => {
      // Only stamp it on — never touch messages/signals. No-op if unchanged.
      if (slice(groupId).sessionId !== sessionId) patchChat(groupId, { sessionId })
    },

    sendUserMessage: async (groupId, text, sessionId) => {
      const cur = slice(groupId)
      const trimmed = text.trim()
      if (!trimmed || cur.sending) return

      const userMsg: ChatMessage = {
        id: nextId(),
        role: 'user',
        text: trimmed,
        at: new Date().toISOString(),
      }
      const history = toConversationHistory(cur.messages)
      patchChat(groupId, (prev) => ({ messages: [...prev.messages, userMsg], sending: true }))

      try {
        const res = await analyzeTurn(sessionId ?? 0, {
          message: trimmed,
          message_source: 'text',
          conversation_history: history,
          // Read the CURRENT signals for THIS group at send time (the slice may have
          // advanced since we captured `cur`); the origin group is fixed by groupId.
          current_signals: slice(groupId).currentSignals,
        })
        const agentMsg: ChatMessage = {
          id: nextId(),
          role: 'agent',
          text: res.agent_reply,
          at: new Date().toISOString(),
        }
        // Append to the ORIGIN group unconditionally — even if the user switched
        // groups while the analyze round-trip was in flight, the reply belongs here.
        patchChat(groupId, (prev) => ({
          messages: [...prev.messages, agentMsg],
          currentSignals: res.extracted_signals,
          missingSignals: res.missing_signals,
          notedPreferences: signalsToNotedPrefs(res.extracted_signals, res.missing_signals),
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
        patchChat(groupId, (prev) => ({ messages: [...prev.messages, errorNotice], sending: false }))
      }
    },
  }
})

// Selectors — parameterized by group, StrictMode-safe stable EMPTY fallback.
export const selectChatMessages = (groupId: number) => (s: ChatState) =>
  (s.byGroup[groupId] ?? EMPTY_CHAT_SLICE).messages
export const selectChatSessionId = (groupId: number) => (s: ChatState) =>
  (s.byGroup[groupId] ?? EMPTY_CHAT_SLICE).sessionId
export const selectNotedPreferences = (groupId: number) => (s: ChatState) =>
  (s.byGroup[groupId] ?? EMPTY_CHAT_SLICE).notedPreferences
export const selectSending = (groupId: number) => (s: ChatState) =>
  (s.byGroup[groupId] ?? EMPTY_CHAT_SLICE).sending
export const selectMissingSignals = (groupId: number) => (s: ChatState) =>
  (s.byGroup[groupId] ?? EMPTY_CHAT_SLICE).missingSignals

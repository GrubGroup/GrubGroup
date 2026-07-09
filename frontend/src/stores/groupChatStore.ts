import { create } from 'zustand'
import type { GroupMessage } from '@/types'
import { getSocket } from '@/lib/socket'

// Live group chat. Messages arrive from the gateway over Socket.IO and are the
// single source of truth: sendMessage() only emits — it does NOT optimistically
// append; the server echoes the message back to everyone (incl. the sender),
// and receiveMessage() appends it. This avoids duplicates and drift.
//
// Session start is broadcast the same way: startSession() emits, and the server
// echoes 'session:start' to everyone in the room, which calls receiveSessionStart
// so every client shows the session card live — inline, after the messages that
// existed when it started.

interface GroupChatState {
  messagesByGroup: Record<number, GroupMessage[]>
  // Per group: index in the message list where the session card belongs, or null
  // if no session has started. null = not started.
  sessionStartIndexByGroup: Record<number, number | null>
  receiveMessage: (msg: GroupMessage) => void
  sendMessage: (groupId: number, text: string) => void
  startSession: (groupId: number) => void
  receiveSessionStart: (groupId: number) => void
}

// Stable empty reference so the messagesFor selector never returns a fresh
// array (which would loop under React 19 StrictMode). Mirrors MenuList's EMPTY.
const EMPTY: GroupMessage[] = []

export const useGroupChatStore = create<GroupChatState>((set) => ({
  messagesByGroup: {},
  sessionStartIndexByGroup: {},

  receiveMessage: (msg) =>
    set((s) => ({
      messagesByGroup: {
        ...s.messagesByGroup,
        [msg.groupId]: [...(s.messagesByGroup[msg.groupId] ?? EMPTY), msg],
      },
    })),

  sendMessage: (groupId, text) => {
    const trimmed = text.trim()
    if (!trimmed) return
    // Fire-and-forget: the message renders when the server echoes it back.
    getSocket()?.emit('chat:message', { groupId, text: trimmed })
  },

  // Emit only — the card appears when the server echoes 'session:start' back.
  startSession: (groupId) => {
    getSocket()?.emit('session:start', { groupId })
  },

  // Record the session-start point at the current message count for this group,
  // so the card renders inline after existing messages. Ignore repeat starts.
  receiveSessionStart: (groupId) =>
    set((s) => {
      if (s.sessionStartIndexByGroup[groupId] != null) return s
      const count = (s.messagesByGroup[groupId] ?? EMPTY).length
      return {
        sessionStartIndexByGroup: { ...s.sessionStartIndexByGroup, [groupId]: count },
      }
    }),
}))

// Selector helper: returns the stable EMPTY array when a group has no messages.
export const selectGroupMessages = (groupId: number) => (s: GroupChatState) =>
  s.messagesByGroup[groupId] ?? EMPTY

// Selector: the message index where the session card belongs, or null.
export const selectSessionStartIndex = (groupId: number) => (s: GroupChatState) =>
  s.sessionStartIndexByGroup[groupId] ?? null

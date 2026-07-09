import { create } from 'zustand'
import type { GroupMessage } from '@/types'
import { getSocket } from '@/lib/socket'

// Live group chat. Messages arrive from the gateway over Socket.IO and are the
// single source of truth: sendMessage() only emits — it does NOT optimistically
// append; the server echoes the message back to everyone (incl. the sender),
// and receiveMessage() appends it. This avoids duplicates and drift.

interface GroupChatState {
  messagesByGroup: Record<number, GroupMessage[]>
  receiveMessage: (msg: GroupMessage) => void
  sendMessage: (groupId: number, text: string) => void
}

// Stable empty reference so the messagesFor selector never returns a fresh
// array (which would loop under React 19 StrictMode). Mirrors MenuList's EMPTY.
const EMPTY: GroupMessage[] = []

export const useGroupChatStore = create<GroupChatState>((set) => ({
  messagesByGroup: {},

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
}))

// Selector helper: returns the stable EMPTY array when a group has no messages.
export const selectGroupMessages = (groupId: number) => (s: GroupChatState) =>
  s.messagesByGroup[groupId] ?? EMPTY

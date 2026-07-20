import { useEffect } from 'react'
import type { GroupMessage, SessionBlock } from '@/types'
import { getSocket } from '@/lib/socket'
import { useAuthStore } from '@/stores/authStore'
import { useGroupChatStore } from '@/stores/groupChatStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useEventListStore } from '@/stores/eventListStore'

// Connects to the gateway socket and wires live group chat + session sync for one
// group. Under mock mode getSocket() returns null and this is a no-op — the
// stores are driven locally instead. Joins the group's room on mount, listens for
// chat + session events, and leaves on unmount.
export function useSocket(groupId: number) {
  const name = useAuthStore((s) => s.user?.display_name ?? s.user?.username)
  const currentUserId = useAuthStore((s) => s.user?.id)

  useEffect(() => {
    // Auth rides on the session cookie (withCredentials); we pass only the
    // cosmetic display name.
    const socket = getSocket({ name: name ?? undefined })
    if (!socket) return

    socket.emit('group:join', { groupId })

    const handleMessage = (msg: GroupMessage) => {
      useGroupChatStore.getState().receiveMessage(msg)
    }
    socket.on('chat:message', handleMessage)

    // Persisted backlog replayed by the gateway right after we join the room.
    // A SESSION_BLOCK row already arrives with type:'session_block' + a parsed
    // `block`, so the picks card reconstructs on reload with no extra handling.
    const handleHistory = (payload: { groupId: number; messages: GroupMessage[] }) => {
      useGroupChatStore.getState().receiveHistory(payload.groupId, payload.messages)
    }
    socket.on('chat:history', handleHistory)

    // A member started a session. Show the inline card, and — when the host
    // included the new sessionId — adopt it so every member's client can drive
    // analyze/ready and shares one countdown anchored to the broadcast `at`.
    const handleSessionStart = (payload: {
      groupId: number
      sessionId?: number | null
      startedBy?: number | null
      at?: string
    }) => {
      useGroupChatStore.getState().receiveSessionStart(payload.groupId, payload.sessionId)
      if (payload.sessionId != null) {
        const store = useSessionStore.getState()
        // The host already set the session locally via the modal; others load it.
        if (store.activeSessionId !== payload.sessionId) {
          void store.load(payload.sessionId, currentUserId ?? store.currentUserId)
        }
        if (payload.at) store.setStartedAt(payload.at)
      }
    }
    socket.on('session:start', handleSessionStart)

    // Live progress: a member finished sharing. Reconcile from the server counts
    // so every client's progress bar + roster update from the echo.
    const handleMemberDone = (payload: {
      doneCount: number
      total: number
      userId: number
      status: boolean
    }) => {
      useSessionStore
        .getState()
        .applyProgress(payload.doneCount, payload.total, payload.userId, payload.status)
    }
    socket.on('session:member_done', handleMemberDone)

    // The orchestrator's top-5 delivered into the chat. Route it through the same
    // receiveMessage path as a history SESSION_BLOCK row so live + reload render
    // identically.
    const handlePicks = (payload: {
      groupId: number
      sessionId: number
      messageId: string
      userId: number | null
      block: SessionBlock
      at: string
    }) => {
      useGroupChatStore.getState().receiveMessage({
        id: payload.messageId,
        groupId: payload.groupId,
        userId: payload.userId,
        name: null,
        text: '',
        at: payload.at,
        type: 'session_block',
        block: payload.block,
      })
    }
    socket.on('session:picks', handlePicks)

    // The host confirmed a restaurant → an Event was created. Refresh the Events
    // tab list so it appears without a manual reload.
    const handleConfirmed = () => {
      void useEventListStore.getState().load()
    }
    socket.on('session:confirmed', handleConfirmed)

    const handleTyping = (payload: {
      groupId: number
      userId: number | null
      name: string | null
      isTyping: boolean
    }) => {
      useGroupChatStore.getState().receiveTyping(payload)
    }
    socket.on('typing:update', handleTyping)

    return () => {
      socket.emit('group:leave', { groupId })
      socket.off('chat:message', handleMessage)
      socket.off('chat:history', handleHistory)
      socket.off('session:start', handleSessionStart)
      socket.off('session:member_done', handleMemberDone)
      socket.off('session:picks', handlePicks)
      socket.off('session:confirmed', handleConfirmed)
      socket.off('typing:update', handleTyping)
    }
  }, [name, currentUserId, groupId])
}

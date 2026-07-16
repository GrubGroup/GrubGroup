import { useEffect } from 'react'
import type { GroupMessage } from '@/types'
import { getSocket } from '@/lib/socket'
import { useAuthStore } from '@/stores/authStore'
import { useGroupChatStore } from '@/stores/groupChatStore'

// Connects to the gateway socket and wires live group chat for one group.
// Under mock mode getSocket() returns null and this is a no-op — the store is
// seeded locally instead. Joins the group's room on mount, listens for incoming
// messages, and leaves on unmount.
export function useSocket(groupId: number) {
  const name = useAuthStore((s) => s.user?.display_name ?? s.user?.username)

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
    const handleHistory = (payload: { groupId: number; messages: GroupMessage[] }) => {
      useGroupChatStore.getState().receiveHistory(payload.groupId, payload.messages)
    }
    socket.on('chat:history', handleHistory)

    const handleSessionStart = (payload: { groupId: number }) => {
      useGroupChatStore.getState().receiveSessionStart(payload.groupId)
    }
    socket.on('session:start', handleSessionStart)

    const handleTyping = (payload: {
      groupId: number
      userId: number | null
      name: string | null
      isTyping: boolean
    }) => {
      useGroupChatStore.getState().receiveTyping(payload)
    }
    socket.on('typing:update', handleTyping)

    // TODO(live, out of scope): session:member_done, event:update.

    return () => {
      socket.emit('group:leave', { groupId })
      socket.off('chat:message', handleMessage)
      socket.off('chat:history', handleHistory)
      socket.off('session:start', handleSessionStart)
      socket.off('typing:update', handleTyping)
    }
  }, [name, groupId])
}

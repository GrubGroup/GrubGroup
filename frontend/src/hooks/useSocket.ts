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
  const token = useAuthStore((s) => s.token)
  const userId = useAuthStore((s) => s.user?.id)
  const name = useAuthStore((s) => s.user?.display_name ?? s.user?.username)

  useEffect(() => {
    const socket = getSocket({
      token: token ?? undefined,
      userId: userId ?? undefined,
      name: name ?? undefined,
    })
    if (!socket) return

    socket.emit('group:join', { groupId })

    const handleMessage = (msg: GroupMessage) => {
      useGroupChatStore.getState().receiveMessage(msg)
    }
    socket.on('chat:message', handleMessage)

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

    // TODO(live, out of scope): session:member_done, cart:update.

    return () => {
      socket.emit('group:leave', { groupId })
      socket.off('chat:message', handleMessage)
      socket.off('session:start', handleSessionStart)
      socket.off('typing:update', handleTyping)
    }
  }, [token, userId, name, groupId])
}

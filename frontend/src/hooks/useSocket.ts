import { useEffect } from 'react'
import { getSocket } from '@/lib/socket'
import { useAuthStore } from '@/stores/authStore'

// Subscribes to gateway socket events and dispatches into stores. Under mock
// mode getSocket() returns null and this is a no-op — stores update locally.
// When going live, wire event handlers here (join/leave, cart sync, preference
// broadcast) to the session/chat/cart stores.
export function useSocket() {
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    const socket = getSocket(token ?? undefined)
    if (!socket) return
    // TODO(live): socket.on('session:member_done', ...) → sessionStore.setMemberDone
    //             socket.on('cart:update', ...) → cartStore
    //             socket.on('chat:message', ...) → chatStore
    return () => {
      socket.off()
    }
  }, [token])
}

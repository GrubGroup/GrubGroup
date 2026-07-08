import { io, type Socket } from 'socket.io-client'
import { GATEWAY_URL, USE_MOCK } from './env'

// Real-time lives in the gateway (Socket.IO). Under mock mode we never connect —
// the session/chat/cart stores are driven locally instead. When going live,
// useSocket() will subscribe to gateway events and dispatch into the stores.
let socket: Socket | null = null

export function getSocket(token?: string): Socket | null {
  if (USE_MOCK) return null
  if (!socket) {
    socket = io(GATEWAY_URL, {
      auth: token ? { token } : undefined,
      autoConnect: true,
    })
  }
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}

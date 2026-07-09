import { io, type Socket } from 'socket.io-client'
import { GATEWAY_URL, USE_MOCK } from './env'

// Real-time lives in the gateway (Socket.IO). Under mock mode we never connect —
// the session/chat/cart stores are driven locally instead. When going live,
// useSocket() subscribes to gateway events and dispatches into the stores.
let socket: Socket | null = null

export interface SocketAuth {
  // The gateway authenticates the handshake from this JWT; connections without
  // a valid token are rejected. Identity (userId/role) is read from the token's
  // claims server-side — `name` is only a cosmetic display label.
  token?: string
  name?: string
}

// Returns the singleton socket, creating it on first call with the given auth.
// Later calls ignore the arg and return the existing connection.
export function getSocket(auth?: SocketAuth): Socket | null {
  if (USE_MOCK) return null
  if (!socket) {
    socket = io(GATEWAY_URL, {
      auth: auth ?? undefined,
      withCredentials: true,
      autoConnect: true,
    })
  }
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}

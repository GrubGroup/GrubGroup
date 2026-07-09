// Socket.IO server setup and (dev-mode) identity handshake.
import { Server } from 'socket.io'
import { config } from '../config/index.js'
import { registerSessionHandlers } from './session.handlers.js'

// Attach a Socket.IO server to an existing HTTP server and wire chat handlers.
export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.CORS_ORIGIN },
  })

  io.on('connection', (socket) => {
    // DEV ONLY: trust the identity the client supplies in the handshake. No JWT
    // verification yet — add it before any real deployment.
    const { userId, name } = socket.handshake.auth || {}
    socket.data.userId = userId != null ? Number(userId) : null
    socket.data.name = name ?? null

    registerSessionHandlers(io, socket)
  })

  return io
}

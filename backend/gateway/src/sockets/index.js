// Socket.IO server setup and JWT-authenticated identity handshake.
import { Server } from 'socket.io'
import { config } from '../config/index.js'
import { verifyToken } from '../services/jwt.service.js'
import { registerSessionHandlers } from './session.handlers.js'

// Attach a Socket.IO server to an existing HTTP server and wire chat handlers.
export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.CORS_ORIGIN, credentials: true },
  })

  // Authenticate every connection from the JWT the client passes in the
  // handshake (frontend sends socket.handshake.auth.token). The security-
  // sensitive identity (userId, role) comes from the verified claims — never
  // from client-supplied values. `name` is a cosmetic display label only.
  io.use((socket, next) => {
    const { token, name } = socket.handshake.auth || {}
    if (!token) {
      return next(new Error('unauthorized'))
    }
    try {
      const claims = verifyToken(token)
      socket.data.userId = claims.userId
      socket.data.role = claims.role
      socket.data.name = name ?? null
      next()
    } catch {
      next(new Error('unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    registerSessionHandlers(io, socket)
  })

  return io
}

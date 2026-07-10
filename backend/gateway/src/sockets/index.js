// Socket.IO server setup and session-authenticated identity handshake.
import { Server } from 'socket.io'
import { config } from '../config/index.js'
import { auth } from '../lib/auth.js'
import { registerSessionHandlers } from './session.handlers.js'

// Attach a Socket.IO server to an existing HTTP server and wire chat handlers.
export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.CORS_ORIGIN, credentials: true },
  })

  // Authenticate every connection from the Better Auth session cookie, which the
  // browser sends on the handshake (client connects with withCredentials). The
  // security-sensitive identity (userId, role) comes from the verified session —
  // never from client-supplied values. `name` is a cosmetic display label only.
  io.use(async (socket, next) => {
    const cookie = socket.handshake.headers.cookie
    if (!cookie) {
      return next(new Error('unauthorized'))
    }
    try {
      // getSession reads the session cookie from the forwarded headers.
      const session = await auth.api.getSession({ headers: new Headers({ cookie }) })
      if (!session) {
        return next(new Error('unauthorized'))
      }
      socket.data.userId = session.user.id
      socket.data.role = session.user.role
      socket.data.name = socket.handshake.auth?.name ?? null
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

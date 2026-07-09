// Entrypoint: create the HTTP server from the Express app, attach Socket.IO, listen.
import { createServer } from 'node:http'
import app from './src/app.js'
import { config } from './src/config/index.js'
import { createSocketServer } from './src/sockets/index.js'

// Express handles REST (auth, /health, AI proxy); Socket.IO shares the same
// HTTP server/port for the live group-chat layer.
const httpServer = createServer(app)

createSocketServer(httpServer)

httpServer.listen(config.PORT, () => {
  console.log(`Gateway listening on http://localhost:${config.PORT}`)
  console.log(`Socket.IO CORS origin: ${config.CORS_ORIGIN}`)
})

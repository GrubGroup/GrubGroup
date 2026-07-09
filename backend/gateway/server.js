// Entrypoint: create HTTP server, attach Socket.IO, and listen.
import { createServer } from 'node:http'
import { config } from './src/config/index.js'
import { createSocketServer } from './src/sockets/index.js'

// Bare HTTP server with a tiny health check. The real work is the Socket.IO
// layer for live group chat; REST routes are not needed for this scope.
const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }
  res.writeHead(404)
  res.end()
})

createSocketServer(httpServer)

httpServer.listen(config.PORT, () => {
  console.log(`Gateway listening on http://localhost:${config.PORT}`)
  console.log(`Socket.IO CORS origin: ${config.CORS_ORIGIN}`)
})

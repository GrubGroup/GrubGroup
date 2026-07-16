// Entrypoint: create the HTTP server from the Express app, attach Socket.IO, listen.
import { createServer } from 'node:http';
import app from './src/app.js';
import { config } from './src/config/index.js';
import { createSocketServer } from './src/sockets/index.js';
import { logger } from './src/utils/logger.js';

// Express handles REST (auth, /health, AI proxy); Socket.IO shares the same
// HTTP server/port for the live group-chat layer.
const httpServer = createServer(app);

// Keep a handle to io on the Express app so REST controllers can broadcast
// real-time events (e.g. the "X has left the group" system message on leave).
const io = createSocketServer(httpServer);
app.set('io', io);

httpServer.listen(config.PORT, () => {
  logger.info(`Gateway listening on http://localhost:${config.PORT}`);
  logger.info(`Socket.IO CORS origin: ${config.CORS_ORIGIN}`);
});

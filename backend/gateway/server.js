// Entrypoint: create HTTP server, attach Express app + Socket.IO, and listen.
import http from 'node:http';
import { createApp } from './src/app.js';
import { attachSockets } from './src/sockets/index.js';
import { config } from './src/config/index.js';
import { logger } from './src/utils/logger.js';

const app = createApp();
const httpServer = http.createServer(app);
attachSockets(httpServer);

httpServer.listen(config.port, () => {
  logger.info(`Gateway listening on http://localhost:${config.port}`);
});

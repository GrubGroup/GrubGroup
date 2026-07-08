// Socket.IO server setup and auth handshake.
import { Server } from 'socket.io';
import { config } from '../config/index.js';

/**
 * Attach a Socket.IO server to the given HTTP server.
 * Handshake auth and session handlers are still stubbed; this only wires up
 * the server so the gateway boots. Returns the io instance.
 * @param {import('http').Server} httpServer
 */
export function attachSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigin },
  });
  return io;
}

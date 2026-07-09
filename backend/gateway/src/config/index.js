// Loads and validates environment configuration.
import 'dotenv/config'

export const config = {
  PORT: Number(process.env.PORT) || 4000,
  // Must match the Vite dev server origin so the browser can open the socket.
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
}

// Loads and validates environment configuration.
import 'dotenv/config'

// Fail fast if the JWT secret is missing — the gateway can't mint or verify
// tokens without it, and ai_service must share the exact same value (HS256).
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required (must match the ai_service JWT_SECRET).')
}

export const config = {
  PORT: Number(process.env.PORT) || 4000,
  // Must match the Vite dev server origin so the browser can open the socket.
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Auth — gateway mints HS256 JWTs; ai_service verifies with the same secret.
  JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Google sign-in: audience the ID token must be issued for.
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',

  // Downstream FastAPI service that owns the DB / AI.
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  DATABASE_URL: process.env.DATABASE_URL || '',
}

// Loads and validates environment configuration.
import 'dotenv/config'

// Fail fast if the Better Auth secret is missing — it signs/encrypts sessions.
const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET
if (!BETTER_AUTH_SECRET) {
  throw new Error('BETTER_AUTH_SECRET is required (used to sign/encrypt sessions).')
}

const PORT = Number(process.env.PORT) || 4000

export const config = {
  PORT,
  // Must match the Vite dev server origin so the browser can open the socket
  // and send credentialed (cookie) requests.
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Auth — Better Auth (cookie sessions). baseURL must match the real origin so
  // OAuth callbacks resolve; defaults to this gateway's own address.
  BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || `http://localhost:${PORT}`,

  // Google OAuth (server-side code exchange — both id + secret required).
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',

  // Downstream FastAPI service.
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  DATABASE_URL: process.env.DATABASE_URL || '',
}

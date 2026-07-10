// Loads and validates environment configuration.
import 'dotenv/config';

// Fail fast if the Better Auth secret is missing — it signs/encrypts sessions.
const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET;
if (!BETTER_AUTH_SECRET) {
  throw new Error('BETTER_AUTH_SECRET is required (used to sign/encrypt sessions).');
}

const PORT = Number(process.env.PORT) || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const DATABASE_URL = process.env.DATABASE_URL || '';

export const config = {
  PORT,
  // Must match the Vite dev server origin so the browser can open the socket
  // and send credentialed (cookie) requests.
  CORS_ORIGIN,

  // Auth — Better Auth (cookie sessions). baseURL must match the real origin so
  // OAuth callbacks resolve; defaults to this gateway's own address.
  BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || `http://localhost:${PORT}`,

  // Google OAuth (server-side code exchange — both id + secret required).
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',

  // Downstream FastAPI service.
  AI_SERVICE_URL,
  DATABASE_URL,

  // camelCase aliases consumed by the AI proxy client (services/aiClient.js).
  // The gateway->ai_service hop authenticates with JWT_SECRET sent as the
  // X-Internal-Secret header, so it stays alongside the Better Auth config.
  aiServiceUrl: AI_SERVICE_URL,
  jwtSecret: process.env.JWT_SECRET || '',
  databaseUrl: DATABASE_URL,
};

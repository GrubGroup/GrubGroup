// Express app factory: middleware setup and route mounting.
import express from 'express'
import cors from 'cors'
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node'
import { config } from './config/index.js'
import { auth } from './lib/auth.js'
import routes from './routes/index.js'
import { errorMiddleware } from './middleware/errorMiddleware.js'

const app = express()

// Credentialed CORS so the browser sends/receives the httpOnly session cookie.
app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }))

// Better Auth owns /api/auth/* (sign-up, sign-in, social, callbacks, sign-out).
// MUST be mounted BEFORE express.json() — the handler needs the raw request body.
app.all('/api/auth/*', toNodeHandler(auth))

// JSON parsing for our own routes, after the auth handler.
app.use(express.json())

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// Convenience endpoint: resolve the current user from the session cookie.
app.get('/api/me', async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
  if (!session) return res.status(401).json({ error: 'Not authenticated.' })
  res.json({ user: session.user })
})

app.use('/api', routes)

app.use(errorMiddleware)

export default app

// Express app factory: middleware setup and route mounting.
import express from 'express'
import cors from 'cors'
import { config } from './config/index.js'
import routes from './routes/index.js'
import { requireAuth } from './middleware/auth.middleware.js'
import { errorMiddleware } from './middleware/error.middleware.js'

const app = express()

app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }))
app.use(express.json())

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// Convenience endpoint for the frontend to resolve the current user from a JWT.
app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.user }))

app.use('/api', routes)

app.use(errorMiddleware)

export default app

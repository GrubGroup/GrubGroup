// Route aggregator: mounts app REST routers under /api.
//
// Auth endpoints are NOT here — Better Auth owns /api/auth/* directly in app.js.
import { Router } from 'express'

const router = Router()

// ai + sessions routers are mounted here as those verticals land.

export default router

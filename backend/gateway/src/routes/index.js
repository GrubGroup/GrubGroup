// Route aggregator: mounts auth, ai, and sessions routers under /api.
import { Router } from 'express'
import authRoutes from './auth.routes.js'

const router = Router()

router.use('/auth', authRoutes)
// ai + sessions routers are mounted here as those verticals land.

export default router

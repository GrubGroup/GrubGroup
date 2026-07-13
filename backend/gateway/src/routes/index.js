// Route aggregator: mounts health, restaurants, sessions, profile, groups,
// and events under /api.
//
// Auth endpoints are NOT here — Better Auth owns /api/auth/* directly in app.js.
import { Router } from 'express';
import restaurantsRouter from './restaurants.routes.js';
import sessionsRouter from './sessions.routes.js';
import profileRouter from './profileRoutes.js';
import groupsRouter from './groupsRoutes.js';
import eventsRouter from './eventsRoutes.js';

const router = Router();

// Liveness probe.
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.use('/restaurants', restaurantsRouter);
router.use('/sessions', sessionsRouter);
router.use('/profile', profileRouter);
router.use('/groups', groupsRouter);
router.use('/events', eventsRouter);

// TODO: mount the ai router here once implemented.

export default router;

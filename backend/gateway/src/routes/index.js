// Route aggregator: mounts health, restaurants, sessions (and future auth/ai).
import { Router } from 'express';
import restaurantsRouter from './restaurants.routes.js';
import sessionsRouter from './sessions.routes.js';

const router = Router();

// Liveness probe.
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.use('/restaurants', restaurantsRouter);
router.use('/sessions', sessionsRouter);

// TODO: mount auth and ai routers here once implemented.

export default router;

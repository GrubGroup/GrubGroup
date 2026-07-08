// Route aggregator: mounts health, restaurants (and future auth/ai/sessions).
import { Router } from 'express';
import restaurantsRouter from './restaurants.routes.js';

const router = Router();

// Liveness probe.
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.use('/restaurants', restaurantsRouter);

// TODO: mount auth, ai, and sessions routers here once implemented.

export default router;

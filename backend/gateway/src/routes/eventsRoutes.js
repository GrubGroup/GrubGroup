// Routes for /events — the caller's dining history. Requires a valid session.
import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { listEvents } from '../controllers/eventsController.js';

const router = Router();

router.use(requireAuth);

router.get('/', listEvents);

export default router;

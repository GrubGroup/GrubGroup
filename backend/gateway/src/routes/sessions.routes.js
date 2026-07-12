// Routes for /sessions — session and event REST.
import { Router } from 'express';
import { getRecommendations } from '../controllers/sessions.controller.js';

const router = Router();

// Trigger the group orchestrator and return the ranked recommendation.
router.post('/:sessionId/recommendations', getRecommendations);

export default router;

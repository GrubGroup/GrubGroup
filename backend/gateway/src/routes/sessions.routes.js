// Routes for /sessions — session lifecycle, membership, Q&A, recommendations, close.
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  getRecommendations,
  createSession,
  getSession,
  joinSession,
  listMembers,
  setReady,
  submitQa,
  getLatestRecommendation,
  closeSession,
  getSessionSummary,
} from '../controllers/sessions.controller.js';

const router = Router();

// Trigger the group orchestrator and return the ranked recommendation.
// (Existing AI-proxy route; unguarded as before.)
router.post('/:session_id/recommendations', getRecommendations);

// Everything below is caller-scoped and requires a valid session.
router.post('/', requireAuth, createSession);
router.get('/:session_id', requireAuth, getSession);

router.post('/:session_id/members', requireAuth, joinSession);
router.get('/:session_id/members', requireAuth, listMembers);
router.patch('/:session_id/members/me', requireAuth, setReady);

router.post('/:session_id/qa', requireAuth, submitQa);

router.get('/:session_id/recommendations', requireAuth, getLatestRecommendation);

router.post('/:session_id/close', requireAuth, closeSession);
router.get('/:session_id/summary', requireAuth, getSessionSummary);

export default router;

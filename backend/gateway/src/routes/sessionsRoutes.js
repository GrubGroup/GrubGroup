// Routes for /sessions — session lifecycle, membership, Q&A, recommendations, close.
import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
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
  analyzeTurn,
} from '../controllers/sessionsController.js';

const router = Router();

// Trigger the group orchestrator and return the ranked recommendation. Now
// AUTH-GUARDED + member-scoped: this route writes a SESSION_BLOCK message into
// the group chat and broadcasts the picks, so it must not be open (an anonymous
// caller who guessed a session_id could otherwise inject a spoofed picks message
// and burn an LLM run). Membership is enforced in the controller.
router.post('/:session_id/recommendations', requireAuth, getRecommendations);

// Everything below is caller-scoped and requires a valid session.
router.post('/', requireAuth, createSession);
router.get('/:session_id', requireAuth, getSession);

router.post('/:session_id/members', requireAuth, joinSession);
router.get('/:session_id/members', requireAuth, listMembers);
router.patch('/:session_id/members/me', requireAuth, setReady);

router.post('/:session_id/qa', requireAuth, submitQa);

// Conversational QA sub-agent turn (proxied to ai_service). Member-scoped.
router.post('/:session_id/analyze', requireAuth, analyzeTurn);

router.get('/:session_id/recommendations', requireAuth, getLatestRecommendation);

router.post('/:session_id/close', requireAuth, closeSession);
router.get('/:session_id/summary', requireAuth, getSessionSummary);

export default router;

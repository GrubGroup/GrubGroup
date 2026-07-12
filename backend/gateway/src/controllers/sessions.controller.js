// Session/event request handlers.
import { getRecommendations as fetchRecommendations } from '../services/aiClient.js';

/**
 * POST /api/sessions/:sessionId/recommendations — proxy the group orchestrator.
 *
 * Delegates to the ai_service, which reconciles member preferences into a ranked
 * recommendation. On an ai_service error we pass its HTTP status through (e.g. 409
 * when not all members have confirmed, 502 on an upstream LLM/embedding failure)
 * rather than collapsing everything to a 500.
 */
export async function getRecommendations(req, res, next) {
  const sessionId = Number(req.params.sessionId);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return res.status(400).json({ error: 'sessionId must be a positive integer' });
  }

  const forcePartial = req.body?.force_partial === true;

  try {
    const recommendation = await fetchRecommendations(sessionId, { forcePartial });
    return res.status(200).json(recommendation);
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    return next(err);
  }
}

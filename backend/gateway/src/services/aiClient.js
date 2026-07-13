// HTTP client proxying AI/RAG calls to the FastAPI ai_service.
import axios from 'axios';
import { config } from '../config/index.js';

const client = axios.create({
  baseURL: config.aiServiceUrl,
  // Embedding tail latency can be high (cold provider routing on OpenRouter),
  // so allow generous headroom before giving up and storing a NULL embedding.
  timeout: 120_000,
  headers: {
    // Shared internal secret so /embed isn't openly callable. Must match the
    // ai_service JWT_SECRET (see app/api/deps.py).
    'X-Internal-Secret': config.jwtSecret,
  },
});

/**
 * Generate an embedding vector for the given text via the ai_service.
 * @param {string} text
 * @returns {Promise<number[]>} the embedding (1024 floats)
 */
const embed = async (text) => {
  const { data } = await client.post('/api/v1/embed', { text });
  return data.embedding;
};

/**
 * Trigger the group orchestrator for a session and return its ranked picks.
 * @param {number} sessionId
 * @param {{ forcePartial?: boolean }} [opts] forcePartial bypasses the
 *   all-members-confirmed guard on the ai_service side.
 * @returns {Promise<object>} RecommendationOut: { id, session_id, created_at, items: [...] }
 */
const getRecommendations = async (sessionId, { forcePartial = false } = {}) => {
  const { data } = await client.post(
    `/api/v1/sessions/${sessionId}/recommendations`,
    { force_partial: forcePartial },
  );
  return data;
};

export { embed, getRecommendations };

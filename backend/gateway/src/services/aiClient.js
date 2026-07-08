// HTTP client proxying AI/RAG calls to the FastAPI ai_service.
import axios from 'axios';
import { config } from '../config/index.js';

const client = axios.create({
  baseURL: config.aiServiceUrl,
  timeout: 30_000,
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
export async function embed(text) {
  const { data } = await client.post('/api/v1/embed', { text });
  return data.embedding;
}

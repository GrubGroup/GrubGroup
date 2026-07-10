// Centralized Express error handler.
//
// Anything with a numeric `status` maps to that status with its message;
// everything else is a 500 with a generic message (details logged).
import { logger } from '../utils/logger.js';

/**
 * Express error-handling middleware. Must be mounted last, after all routes.
 * Responds with JSON { error } and a status from err.status (default 500).
 */
// eslint-disable-next-line no-unused-vars -- Express detects the 4-arg signature
export function errorMiddleware(err, req, res, next) {
  const status = Number.isInteger(err?.status) ? err.status : 500;
  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} ->`, err);
  }
  res.status(status).json({
    error: status >= 500 ? 'Internal server error.' : err.message ?? 'Internal Server Error',
  });
}

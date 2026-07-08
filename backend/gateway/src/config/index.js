// Loads and validates environment configuration.
import 'dotenv/config';

/**
 * Read a required env var, failing fast if it's missing/empty.
 * @param {string} name
 * @returns {string}
 */
function required(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  jwtSecret: required('JWT_SECRET'),
  aiServiceUrl: required('AI_SERVICE_URL'),
  databaseUrl: required('DATABASE_URL'),
};

// Express app factory: middleware setup and route mounting.
import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { errorMiddleware } from './middleware/error.middleware.js';

/**
 * Build and configure the Express application.
 * @returns {import('express').Express}
 */
export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.use('/api', routes);

  // Error handler must be mounted last.
  app.use(errorMiddleware);

  return app;
}

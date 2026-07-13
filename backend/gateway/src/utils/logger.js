// Logging helper.

/**
 * Minimal timestamped console logger. Swap for pino/winston later if needed.
 */
const logger = {
  info: (...args) => console.log('[info]', ...args),
  warn: (...args) => console.warn('[warn]', ...args),
  error: (...args) => console.error('[error]', ...args),
};

export { logger };

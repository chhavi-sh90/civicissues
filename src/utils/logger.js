// src/utils/logger.js
// Minimal leveled logger. Kept dependency-free (no winston/pino) so the
// project stays easy for a beginner to read end-to-end. Swap this out
// for winston later if you need file rotation etc.

function timestamp() {
  return new Date().toISOString();
}

const logger = {
  info: (msg) => console.log(`[INFO]  ${timestamp()} - ${msg}`),
  warn: (msg) => console.warn(`[WARN]  ${timestamp()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${timestamp()} - ${msg}`),
  debug: (msg) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${timestamp()} - ${msg}`);
    }
  },
};

module.exports = logger;

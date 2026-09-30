// src/server.js
// Entry point. Run with: npm run dev  (or) npm start

const app = require('./app');
const env = require('./config/env');
const { testConnection } = require('./config/db');
const logger = require('./utils/logger');

async function start() {
  try {
    // Fail fast if MySQL is unreachable, rather than starting a server
    // that will error on the very first request.
    await testConnection();

    app.listen(env.PORT, () => {
      logger.info(`Civic Connect API listening on http://localhost:${env.PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
      logger.info(`Upload strategy: ${env.UPLOAD_STRATEGY}`);
      logger.info(`Firebase configured: ${env.FIREBASE_CONFIGURED}`);
    });
  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
}

start();

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled promise rejection: ${reason}`);
});

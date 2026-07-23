const http = require('http');
const config = require('./config/env');
const { connectDB, disconnectDB } = require('./config/database');
const { initSocket } = require('./events/socket');
const logger = require('./utils/logger');
const app = require('./app');

const server = http.createServer(app);

// ─── Socket.io ─────────────────────────────────────────────────────────────────
initSocket(server);

// ─── Start ─────────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    await connectDB();

    server.listen(config.port, () => {
      logger.info(`QuickBite API listening on port ${config.port} [${config.env}]`);
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${config.port} is already in use. Stop the other dev server (Ctrl+C) and run "npm run dev" once.`);
        process.exit(1);
      }
      throw err;
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();

// ─── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });

  // Force-exit if something hangs
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = server;

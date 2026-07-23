const Bull = require('bull');
const config = require('../config/env');
const logger = require('../utils/logger');

const redisOpts = {
  redis: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  },
};

// ─── Queue Definitions ────────────────────────────────────────────────────────

const notificationQueue = new Bull('notifications', redisOpts);
const orderTimeoutQueue  = new Bull('order-timeouts',  redisOpts);
const emailQueue         = new Bull('emails',          redisOpts);

// ─── Global Error Handlers ────────────────────────────────────────────────────

const isDev = process.env.NODE_ENV !== 'production';

[notificationQueue, orderTimeoutQueue, emailQueue].forEach((queue) => {
  queue.on('failed', (job, err) => {
    logger.error(`Queue [${queue.name}] job ${job.id} failed: ${err.message}`);
  });
  queue.on('error', (err) => {
    // Redis unavailable in dev — suppress connection noise, log once at debug
    if (isDev) { logger.debug(`Queue [${queue.name}] offline (no Redis)`); return; }
    logger.error(`Queue [${queue.name}] error: ${err.message}`);
  });
  queue.on('completed', (job) => {
    logger.debug(`Queue [${queue.name}] job ${job.id} completed`);
  });
});

module.exports = { notificationQueue, orderTimeoutQueue, emailQueue };

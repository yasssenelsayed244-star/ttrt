const Bull = require('bull');
const config = require('./env');
const logger = require('../utils/logger');

const REDIS_OPTS = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
};

// ─── Define Queues ────────────────────────────────────────────────────────────

const notificationQueue = new Bull('notifications', { redis: REDIS_OPTS });
const emailQueue        = new Bull('emails',        { redis: REDIS_OPTS });
const orderQueue        = new Bull('orders',        { redis: REDIS_OPTS });
const smsQueue          = new Bull('sms',           { redis: REDIS_OPTS });

// ─── Global Error Listeners ───────────────────────────────────────────────────

[notificationQueue, emailQueue, orderQueue, smsQueue].forEach((queue) => {
  queue.on('error', (err) => logger.error(`[Queue:${queue.name}] Error: ${err.message}`));
  queue.on('failed', (job, err) => logger.error(`[Queue:${queue.name}] Job ${job.id} failed: ${err.message}`));
  queue.on('completed', (job) => logger.debug(`[Queue:${queue.name}] Job ${job.id} done`));
});

// ─── Job Adders (sugar helpers) ───────────────────────────────────────────────

const addNotificationJob = (data, opts = {}) =>
  notificationQueue.add(data, { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, ...opts });

const addEmailJob = (data, opts = {}) =>
  emailQueue.add(data, { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, ...opts });

const addOrderTimeoutJob = (orderId, delayMs) =>
  orderQueue.add('timeout', { orderId }, { delay: delayMs, attempts: 1, jobId: `timeout_${orderId}` });

const removeOrderTimeoutJob = async (orderId) => {
  const job = await orderQueue.getJob(`timeout_${orderId}`);
  if (job) await job.remove();
};

const addSmsJob = (data, opts = {}) =>
  smsQueue.add(data, { attempts: 3, backoff: { type: 'fixed', delay: 3000 }, ...opts });

module.exports = {
  notificationQueue,
  emailQueue,
  orderQueue,
  smsQueue,
  addNotificationJob,
  addEmailJob,
  addOrderTimeoutJob,
  removeOrderTimeoutJob,
  addSmsJob,
};

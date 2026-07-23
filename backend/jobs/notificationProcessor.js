const { notificationQueue } = require('./queues');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

// ─── Job Types ─────────────────────────────────────────────────────────────────
// { type: 'order_update', userId, title, body, data }
// { type: 'bulk_promo',   userIds, title, body, data }

notificationQueue.process('send', 5, async (job) => {
  const { userId, type, title, body, data, channel } = job.data;
  await notificationService.create(userId, { type, title, body, data, channel });
  return { sent: true };
});

notificationQueue.process('bulk', 2, async (job) => {
  const { userIds, type, title, body, data } = job.data;
  const count = await notificationService.bulkCreate(userIds, { type, title, body, data });
  logger.info(`Bulk notification sent to ${count} users`);
  return { count };
});

// ─── Helpers to enqueue ────────────────────────────────────────────────────────

const enqueueNotification = (userId, payload, opts = {}) => {
  return notificationQueue.add('send', { userId, ...payload }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true,
    ...opts,
  });
};

const enqueueBulkNotification = (userIds, payload) => {
  return notificationQueue.add('bulk', { userIds, ...payload }, {
    attempts: 2,
    removeOnComplete: true,
  });
};

module.exports = { enqueueNotification, enqueueBulkNotification };

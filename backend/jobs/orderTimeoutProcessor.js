const { orderTimeoutQueue } = require('./queues');
const { Order, ORDER_STATUS } = require('../models/Order');
const logger = require('../utils/logger');

const CONFIRM_TIMEOUT_MS  = 5  * 60 * 1000; // 5 min  — restaurant must confirm
const PICKUP_TIMEOUT_MS   = 30 * 60 * 1000; // 30 min — driver must pick up

/**
 * Schedule a timeout check for a specific order status
 */
const scheduleOrderTimeout = async (orderId, currentStatus) => {
  const delays = {
    [ORDER_STATUS.PLACED]:    CONFIRM_TIMEOUT_MS,
    [ORDER_STATUS.CONFIRMED]: PICKUP_TIMEOUT_MS,
  };

  const delay = delays[currentStatus];
  if (!delay) return;

  await orderTimeoutQueue.add(
    'check',
    { orderId, expectedStatus: currentStatus },
    {
      delay,
      jobId: `timeout_${orderId}_${currentStatus}`, // prevent duplicates
      attempts: 1,
      removeOnComplete: true,
    }
  );

  logger.debug(`Timeout scheduled for order ${orderId} in ${delay / 1000}s`);
};

/**
 * Remove a scheduled timeout (e.g. when order progresses before timeout)
 */
const clearOrderTimeout = async (orderId, status) => {
  const job = await orderTimeoutQueue.getJob(`timeout_${orderId}_${status}`);
  if (job) await job.remove();
};

// ─── Processor ────────────────────────────────────────────────────────────────

orderTimeoutQueue.process('check', async (job) => {
  const { orderId, expectedStatus } = job.data;

  const order = await Order.findById(orderId);
  if (!order) return;

  // Only act if the order is still stuck in the expected status
  if (order.status !== expectedStatus) return;

  logger.warn(`Order ${order.orderNumber} timed out at status ${expectedStatus} — auto-cancelling`);

  order.cancellationReason = `Auto-cancelled: no response within allowed time`;
  await order.transitionTo(ORDER_STATUS.CANCELLED, null, 'System auto-cancel (timeout)');

  // Emit socket event
  if (global._io) {
    global._io.to(order.customerId.toString()).emit('order:cancelled', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      reason: order.cancellationReason,
    });
  }
});

module.exports = { scheduleOrderTimeout, clearOrderTimeout };

const { orderQueue } = require('../config/queues');
const { Order, ORDER_STATUS } = require('../models/Order');
const { addNotificationJob } = require('../config/queues');
const logger = require('../utils/logger');

const ORDER_CONFIRMATION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const ORDER_PICKUP_TIMEOUT_MS       = 60 * 60 * 1000; // 1 hour

// ─── Timeout Job ─────────────────────────────────────────────────────────────
// Auto-cancels orders that aren't confirmed within timeout

orderQueue.process('timeout', async (job) => {
  const { orderId } = job.data;

  const order = await Order.findById(orderId);
  if (!order) return;

  // Only auto-cancel if still in PLACED status
  if (order.status !== ORDER_STATUS.PLACED) return;

  logger.warn(`Order ${order.orderNumber} timed out — auto-cancelling`);

  order.cancellationReason = 'Restaurant did not confirm order in time';
  order.status = ORDER_STATUS.CANCELLED;
  order.statusHistory.push({
    status: ORDER_STATUS.CANCELLED,
    note: 'Auto-cancelled: no restaurant response',
  });
  order.timeline.cancelledAt = new Date();
  await order.save();

  // Notify customer
  await addNotificationJob({
    userId: order.customerId,
    type: 'order_update',
    title: 'Order Cancelled',
    body: `Your order #${order.orderNumber} was cancelled because the restaurant didn't respond in time.`,
    data: { orderId: order._id, orderNumber: order.orderNumber },
  });

  // If paid, initiate refund
  if (order.payment.status === 'paid') {
    order.payment.status = 'refunded';
    await order.save();
    logger.info(`Auto-refund initiated for order ${order.orderNumber}`);
  }
});

// ─── Queue Event Hooks (schedule timeouts when orders are placed) ─────────────

module.exports = {
  scheduleOrderTimeout: (orderId) => {
    const { addOrderTimeoutJob } = require('../config/queues');
    return addOrderTimeoutJob(orderId, ORDER_CONFIRMATION_TIMEOUT_MS);
  },
  cancelOrderTimeout: (orderId) => {
    const { removeOrderTimeoutJob } = require('../config/queues');
    return removeOrderTimeoutJob(orderId);
  },
};

logger.info('Order timeout worker started');

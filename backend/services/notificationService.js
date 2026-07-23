const Notification = require('../models/Notification');
const { getPagination, buildPaginationMeta } = require('../utils/apiResponse');
const logger = require('../utils/logger');

const notificationService = {
  /**
   * Create and optionally push a notification
   */
  async create(userId, { type, title, body, data = {}, channel = 'in_app' }) {
    const notification = await Notification.create({
      userId,
      type,
      title,
      body,
      data,
      channel,
    });

    // Push via Socket.io (in-app)
    if (global._io) {
      global._io.to(userId.toString()).emit('notification:new', {
        id: notification._id,
        type,
        title,
        body,
        data,
        createdAt: notification.createdAt,
      });
    }

    return notification;
  },

  /**
   * Bulk notify multiple users (e.g. promo broadcast)
   */
  async bulkCreate(userIds, payload) {
    const docs = userIds.map((userId) => ({ userId, ...payload }));
    const notifications = await Notification.insertMany(docs, { ordered: false });

    if (global._io) {
      for (const userId of userIds) {
        global._io.to(userId.toString()).emit('notification:new', payload);
      }
    }

    return notifications.length;
  },

  /**
   * Get user notifications with pagination
   */
  async getForUser(userId, query) {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter = { userId };
    if (query.unreadOnly === 'true') filter.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: buildPaginationMeta(total, page, limit),
    };
  },

  /**
   * Mark notification(s) as read
   */
  async markRead(userId, notificationIds) {
    await Notification.updateMany(
      { _id: { $in: notificationIds }, userId },
      { $set: { isRead: true, readAt: new Date() } }
    );
  },

  /**
   * Mark all as read
   */
  async markAllRead(userId) {
    await Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
  },

  // ─── Predefined notification templates ─────────────────────────────────────

  async orderPlaced(customerId, orderNumber) {
    return this.create(customerId, {
      type: 'order_update',
      title: 'Order Placed!',
      body: `Your order #${orderNumber} has been received.`,
      data: { orderNumber },
    });
  },

  async orderConfirmed(customerId, orderNumber) {
    return this.create(customerId, {
      type: 'order_update',
      title: 'Order Confirmed',
      body: `Restaurant confirmed your order #${orderNumber} and is preparing it.`,
      data: { orderNumber },
    });
  },

  async driverAssigned(customerId, orderNumber, driverName) {
    return this.create(customerId, {
      type: 'driver_assigned',
      title: 'Driver On the Way!',
      body: `${driverName} is picking up your order #${orderNumber}.`,
      data: { orderNumber },
    });
  },

  async orderDelivered(customerId, orderNumber) {
    return this.create(customerId, {
      type: 'order_update',
      title: 'Order Delivered!',
      body: `Your order #${orderNumber} has been delivered. Enjoy your meal!`,
      data: { orderNumber },
    });
  },
};

module.exports = notificationService;

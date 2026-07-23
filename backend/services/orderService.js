const { scheduleOrderTimeout, clearOrderTimeout } = require('../jobs/orderTimeoutProcessor');
const { enqueueNotification } = require('../jobs/notificationProcessor');
const { sendOrderConfirmationEmail } = require('../jobs/emailProcessor');
const { Order, ORDER_STATUS } = require('../models/Order');
const Driver = require('../models/Driver');
const Restaurant = require('../models/Restaurant');
const cartService = require('./cartService');
const notificationService = require('./notificationService');
const { AppError } = require('../middleware/errorHandler');
const { getPagination, buildPaginationMeta } = require('../utils/apiResponse');
const { getDistanceKm, estimateDeliveryTime } = require('../utils/geolocation');

const logger = require('../utils/logger');

const orderService = {
  /**
   * Place a new order from cart
   */
  async placeOrder(customerId, { deliveryAddress, paymentMethod, notes }) {
    // Validate cart and get pricing
    const checkout = await cartService.validateForCheckout(customerId);

    const order = await Order.create({
      customerId,
      restaurantId: checkout.restaurantId,
      items: checkout.items,
      pricing: checkout.pricing,
      deliveryAddress,
      payment: { method: paymentMethod, status: paymentMethod === 'cash' ? 'pending' : 'pending' },
      notes,
      statusHistory: [{ status: ORDER_STATUS.PLACED, updatedBy: customerId }],
    });

    // Clear cart after successful order
    await cartService.clearCart(customerId);

    // Schedule auto-cancel if restaurant doesn't confirm in 10 min
    addOrderTimeoutJob(order._id, 10 * 60 * 1000).catch(() => {});

    // Notify customer via queue
    addNotificationJob({
      userId: customerId.toString(),
      type: 'order_update',
      title: 'Order Placed!',
      body: `Your order #${order.orderNumber} has been received.`,
      data: { orderId: order._id.toString(), orderNumber: order.orderNumber },
    }).catch(() => {});

    // Emit socket event to restaurant
    this._emitOrderEvent('order:new', order.restaurantId, { orderId: order._id, orderNumber: order.orderNumber });

    return order.populate('restaurantId', 'name logo contact');
  },

  /**
   * Get orders for a customer
   */
  async getCustomerOrders(customerId, query) {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter = { customerId };
    if (query.status) filter.status = query.status;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('restaurantId', 'name logo')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    return { orders, pagination: buildPaginationMeta(total, page, limit) };
  },

  /**
   * Get orders for a restaurant
   */
  async getRestaurantOrders(restaurantId, query) {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter = { restaurantId };
    if (query.status) filter.status = query.status;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('customerId', 'profile.firstName profile.lastName phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    return { orders, pagination: buildPaginationMeta(total, page, limit) };
  },

  /**
   * Get single order (with auth check)
   */
  async getOrder(orderId, userId, userRole) {
    const order = await Order.findById(orderId)
      .populate('restaurantId', 'name logo address contact')
      .populate('driverId', 'userId vehicle currentLocation rating')
      .populate('customerId', 'profile.firstName profile.lastName phone');

    if (!order) throw new AppError('Order not found', 404);

    // Authorization: customer sees their own, owner sees their restaurant's
    if (userRole === 'customer' && order.customerId._id.toString() !== userId.toString()) {
      throw new AppError('Not authorized', 403);
    }
    if (userRole === 'restaurant_owner') {
      const restaurant = await Restaurant.findOne({ _id: order.restaurantId, ownerId: userId });
      if (!restaurant) throw new AppError('Not authorized', 403);
    }

    return order;
  },

  /**
   * Update order status with state machine validation
   */
  async updateStatus(orderId, newStatus, userId, userRole, note = '') {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);

    if (!order.canTransitionTo(newStatus, userRole)) {
      throw new AppError(
        `Cannot transition order from ${order.status} to ${newStatus}`,
        400
      );
    }

    await order.transitionTo(newStatus, userId, note);

    // Cancel timeout when restaurant confirms
    if (newStatus === ORDER_STATUS.CONFIRMED) {
      removeOrderTimeoutJob(order._id).catch(() => {});
    }

    // Auto-assign driver when order is READY
    if (newStatus === ORDER_STATUS.READY) {
      this._assignDriver(order).catch((err) =>
        logger.error(`Driver assignment failed for order ${orderId}: ${err.message}`)
      );
    }

    // Emit socket update to customer
    this._emitOrderEvent('order:status_updated', order.customerId, {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: newStatus,
    });

    return order;
  },

  /**
   * Cancel order
   */
  async cancelOrder(orderId, userId, userRole, reason) {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);

    // Only customer can cancel PLACED orders, restaurant can cancel PLACED/CONFIRMED
    if (!order.canTransitionTo(ORDER_STATUS.CANCELLED, userRole)) {
      throw new AppError('This order cannot be cancelled at this stage', 400);
    }

    if (userRole === 'customer' && order.customerId.toString() !== userId.toString()) {
      throw new AppError('Not authorized', 403);
    }

    order.cancellationReason = reason;
    await order.transitionTo(ORDER_STATUS.CANCELLED, userId, reason);

    // If payment was made, initiate refund
    if (order.payment.status === 'paid') {
      await this._initiateRefund(order);
    }

    return order;
  },

  /**
   * Rate order (customer rates restaurant + driver)
   */
  async rateOrder(orderId, customerId, { restaurantRating, restaurantComment, driverRating, driverComment }) {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);

    if (order.customerId.toString() !== customerId.toString()) {
      throw new AppError('Not authorized', 403);
    }
    if (order.status !== ORDER_STATUS.DELIVERED) {
      throw new AppError('Can only rate delivered orders', 400);
    }
    if (order.rating?.customerToRestaurant?.rating) {
      throw new AppError('Order already rated', 409);
    }

    if (restaurantRating) {
      order.rating.customerToRestaurant = { rating: restaurantRating, comment: restaurantComment };
      const restaurant = await Restaurant.findById(order.restaurantId);
      if (restaurant) await restaurant.updateRating(restaurantRating);
    }

    if (driverRating && order.driverId) {
      order.rating.customerToDriver = { rating: driverRating, comment: driverComment };
      const driver = await Driver.findById(order.driverId);
      if (driver) await driver.updateRating(driverRating);
    }

    await order.save();
    return order;
  },

  /**
   * Get live order tracking data
   */
  async getTracking(orderId, customerId) {
    const order = await Order.findOne({ _id: orderId, customerId })
      .populate({
        path: 'driverId',
        select: 'currentLocation vehicle rating',
        populate: { path: 'userId', select: 'profile.firstName profile.lastName' },
      })
      .populate('restaurantId', 'name address');

    if (!order) throw new AppError('Order not found', 404);

    const restaurantCoords = order.restaurantId?.address?.coordinates;
    const deliveryCoords = order.deliveryAddress?.coordinates;

    let estimatedMinutes = null;
    if (restaurantCoords && deliveryCoords) {
      const dist = getDistanceKm(restaurantCoords, deliveryCoords);
      estimatedMinutes = estimateDeliveryTime(dist);
    }

    return {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      statusHistory: order.statusHistory,
      driver: order.driverId
        ? {
            name: order.driverId.userId?.profile?.firstName,
            vehicle: order.driverId.vehicle,
            currentLocation: order.driverId.currentLocation?.coordinates,
            rating: order.driverId.rating,
          }
        : null,
      restaurant: {
        name: order.restaurantId?.name,
        coordinates: restaurantCoords,
      },
      deliveryAddress: order.deliveryAddress,
      estimatedMinutes,
      timeline: order.timeline,
    };
  },

  // ─── Driver Assignment ──────────────────────────────────────────────────────

  async _assignDriver(order) {
    const restaurant = await Restaurant.findById(order.restaurantId).select('address.coordinates');
    if (!restaurant?.address?.coordinates) return;

    const { lat, lng } = restaurant.address.coordinates;

    // Find nearest available driver (within 5km)
    const nearbyDriver = await Driver.findOne({
      status: 'available',
      activeOrderId: null,
      geoLocation: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: 5000,
        },
      },
    });

    if (!nearbyDriver) {
      logger.warn(`No available driver found for order ${order.orderNumber}`);
      return;
    }

    // Assign
    order.driverId = nearbyDriver._id;
    await order.save();

    nearbyDriver.status = 'busy';
    nearbyDriver.activeOrderId = order._id;
    await nearbyDriver.save();

    logger.info(`Driver ${nearbyDriver._id} assigned to order ${order.orderNumber}`);

    this._emitOrderEvent('order:driver_assigned', order.customerId, {
      orderId: order._id,
      driverId: nearbyDriver._id,
    });
  },

  async _initiateRefund(order) {
    // TODO: integrate with payment gateway
    logger.info(`Initiating refund for order ${order.orderNumber}`);
    order.payment.status = 'refunded';
    await order.save();
  },

  _emitOrderEvent(event, targetId, payload) {
    try {
      const io = global._io;
      if (io) io.to(targetId.toString()).emit(event, payload);
    } catch (err) {
      logger.warn(`Socket emit failed: ${err.message}`);
    }
  },
};

module.exports = orderService;

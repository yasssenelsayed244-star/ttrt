const Driver = require('../models/Driver');
const { Order, ORDER_STATUS } = require('../models/Order');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const { getPagination, buildPaginationMeta } = require('../utils/apiResponse');

const driverService = {
  /**
   * Register driver profile (after user account exists)
   */
  async register(userId, data) {
    const existing = await Driver.findOne({ userId });
    if (existing) throw new AppError('Driver profile already exists', 409);

    const driver = await Driver.create({ userId, ...data });

    // Update user role
    await User.findByIdAndUpdate(userId, { role: 'driver' });

    return driver.populate('userId', 'profile.firstName profile.lastName email phone');
  },

  /**
   * Get driver profile (by userId or driverId)
   */
  async getProfile(userId) {
    const driver = await Driver.findOne({ userId })
      .populate('userId', 'profile.firstName profile.lastName email phone');
    if (!driver) throw new AppError('Driver profile not found', 404);
    return driver;
  },

  /**
   * Update location in real-time
   */
  async updateLocation(userId, lat, lng) {
    const driver = await Driver.findOne({ userId });
    if (!driver) throw new AppError('Driver not found', 404);
    await driver.updateLocation(lat, lng);

    // Emit to customer tracking their order
    if (driver.activeOrderId && global._io) {
      const order = await Order.findById(driver.activeOrderId).select('customerId');
      if (order) {
        global._io.to(order.customerId.toString()).emit('driver:location', {
          orderId: driver.activeOrderId,
          coordinates: { lat, lng },
        });
      }
    }

    return { lat, lng, updatedAt: new Date() };
  },

  /**
   * Toggle driver availability
   */
  async toggleStatus(userId, status) {
    const VALID = ['offline', 'available', 'on_break'];
    if (!VALID.includes(status)) throw new AppError('Invalid status', 400);

    const driver = await Driver.findOne({ userId });
    if (!driver) throw new AppError('Driver not found', 404);

    if (driver.activeOrderId) {
      throw new AppError('Cannot change status while on an active delivery', 400);
    }

    driver.status = status;
    await driver.save();
    return driver;
  },

  /**
   * Get driver's delivery history
   */
  async getDeliveries(userId, query) {
    const driver = await Driver.findOne({ userId });
    if (!driver) throw new AppError('Driver not found', 404);

    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter = { driverId: driver._id, status: ORDER_STATUS.DELIVERED };

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('restaurantId', 'name')
        .populate('customerId', 'profile.firstName profile.lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    return { orders, pagination: buildPaginationMeta(total, page, limit) };
  },

  /**
   * Get driver earnings summary
   */
  async getEarnings(userId) {
    const driver = await Driver.findOne({ userId }).select('earnings totalDeliveries rating');
    if (!driver) throw new AppError('Driver not found', 404);

    // Earnings per day (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dailyEarnings = await Order.aggregate([
      {
        $match: {
          driverId: driver._id,
          status: ORDER_STATUS.DELIVERED,
          'timeline.deliveredAt': { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timeline.deliveredAt' } },
          deliveries: { $sum: 1 },
          earned: { $sum: '$pricing.deliveryFee' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      balance: driver.earnings.balance,
      totalEarned: driver.earnings.totalEarned,
      totalDeliveries: driver.totalDeliveries,
      rating: driver.rating,
      dailyEarnings,
    };
  },

  /**
   * Admin: list all drivers
   */
  async listAll(query) {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.zone) filter.zone = query.zone;

    const [drivers, total] = await Promise.all([
      Driver.find(filter)
        .populate('userId', 'profile.firstName profile.lastName phone email')
        .skip(skip)
        .limit(limit)
        .lean(),
      Driver.countDocuments(filter),
    ]);

    return { drivers, pagination: buildPaginationMeta(total, page, limit) };
  },
};

module.exports = driverService;

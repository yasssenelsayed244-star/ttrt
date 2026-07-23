const { Order, ORDER_STATUS } = require('../models/Order');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const Driver = require('../models/Driver');
const Review = require('../models/Review');
const { setCache, getCache } = require('../config/redis');

const analyticsService = {
  /**
   * High-level dashboard KPIs
   */
  async getDashboardKPIs() {
    const cacheKey = 'analytics:kpis';
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const todayStart  = new Date(now.setHours(0, 0, 0, 0));
    const weekStart   = new Date(Date.now() - 7  * 86400000);
    const monthStart  = new Date(Date.now() - 30 * 86400000);

    const [
      totalUsers, newUsersToday, newUsersWeek,
      totalRestaurants, activeRestaurants, pendingRestaurants,
      totalOrders, ordersToday, ordersWeek,
      revenueToday, revenueWeek, revenueMonth,
      availableDrivers, busyDrivers,
      avgRating,
      cancelRate,
    ] = await Promise.all([
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ createdAt: { $gte: todayStart } }),
      User.countDocuments({ createdAt: { $gte: weekStart } }),

      Restaurant.countDocuments(),
      Restaurant.countDocuments({ status: 'active' }),
      Restaurant.countDocuments({ status: 'pending' }),

      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: todayStart } }),
      Order.countDocuments({ createdAt: { $gte: weekStart } }),

      _sumRevenue({ createdAt: { $gte: todayStart }, status: ORDER_STATUS.DELIVERED }),
      _sumRevenue({ createdAt: { $gte: weekStart },  status: ORDER_STATUS.DELIVERED }),
      _sumRevenue({ createdAt: { $gte: monthStart }, status: ORDER_STATUS.DELIVERED }),

      Driver.countDocuments({ status: 'available' }),
      Driver.countDocuments({ status: 'busy' }),

      Review.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' } } }]),

      _cancelRate(weekStart),
    ]);

    const result = {
      users:       { total: totalUsers, newToday: newUsersToday, newThisWeek: newUsersWeek },
      restaurants: { total: totalRestaurants, active: activeRestaurants, pending: pendingRestaurants },
      orders:      { total: totalOrders, today: ordersToday, thisWeek: ordersWeek },
      revenue:     { today: revenueToday, thisWeek: revenueWeek, thisMonth: revenueMonth },
      drivers:     { available: availableDrivers, busy: busyDrivers },
      platform:    {
        avgRating: +(avgRating[0]?.avg || 0).toFixed(2),
        cancelRateWeek: `${cancelRate}%`,
      },
    };

    await setCache(cacheKey, result, 120); // 2 min cache
    return result;
  },

  /**
   * Revenue over time — daily breakdown
   */
  async getRevenueChart(days = 30) {
    const cacheKey = `analytics:revenue:${days}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const from = new Date(Date.now() - days * 86400000);

    const data = await Order.aggregate([
      { $match: { status: ORDER_STATUS.DELIVERED, 'timeline.deliveredAt': { $gte: from } } },
      {
        $group: {
          _id:          { $dateToString: { format: '%Y-%m-%d', date: '$timeline.deliveredAt' } },
          orders:       { $sum: 1 },
          revenue:      { $sum: '$pricing.total' },
          avgOrderValue:{ $avg: '$pricing.total' },
          deliveryFees: { $sum: '$pricing.deliveryFee' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Fill gaps with zero days
    const filled = _fillDateGaps(from, new Date(), data);
    await setCache(cacheKey, filled, 300);
    return filled;
  },

  /**
   * Orders breakdown by status + payment method
   */
  async getOrdersBreakdown(days = 30) {
    const from = new Date(Date.now() - days * 86400000);

    const [byStatus, byPayment, byHour] = await Promise.all([
      Order.aggregate([
        { $match: { createdAt: { $gte: from } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: from } } },
        { $group: { _id: '$payment.method', count: { $sum: 1 }, total: { $sum: '$pricing.total' } } },
      ]),
      // Peak hours
      Order.aggregate([
        { $match: { createdAt: { $gte: from } } },
        { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return { byStatus, byPayment, byHour };
  },

  /**
   * Top performing restaurants
   */
  async getTopRestaurants(limit = 10, days = 30) {
    const cacheKey = `analytics:top_restaurants:${limit}:${days}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const from = new Date(Date.now() - days * 86400000);

    const data = await Order.aggregate([
      { $match: { status: ORDER_STATUS.DELIVERED, createdAt: { $gte: from } } },
      {
        $group: {
          _id:        '$restaurantId',
          orders:     { $sum: 1 },
          revenue:    { $sum: '$pricing.total' },
          avgOrder:   { $avg: '$pricing.total' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'restaurants',
          localField: '_id',
          foreignField: '_id',
          as: 'restaurant',
        },
      },
      { $unwind: '$restaurant' },
      {
        $project: {
          name:    '$restaurant.name',
          logo:    '$restaurant.logo',
          cuisine: '$restaurant.cuisine',
          rating:  '$restaurant.rating',
          orders:  1,
          revenue: 1,
          avgOrder: { $round: ['$avgOrder', 2] },
        },
      },
    ]);

    await setCache(cacheKey, data, 300);
    return data;
  },

  /**
   * Top customers by spend
   */
  async getTopCustomers(limit = 10, days = 30) {
    const from = new Date(Date.now() - days * 86400000);

    return Order.aggregate([
      { $match: { status: ORDER_STATUS.DELIVERED, createdAt: { $gte: from } } },
      {
        $group: {
          _id:    '$customerId',
          orders: { $sum: 1 },
          spent:  { $sum: '$pricing.total' },
        },
      },
      { $sort: { spent: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          firstName: '$user.profile.firstName',
          lastName:  '$user.profile.lastName',
          email:     '$user.email',
          orders:    1,
          spent:     { $round: ['$spent', 2] },
        },
      },
    ]);
  },

  /**
   * Driver performance stats
   */
  async getDriverStats(days = 30) {
    const from = new Date(Date.now() - days * 86400000);

    const [deliveries, avgDeliveryTime] = await Promise.all([
      Order.aggregate([
        { $match: { status: ORDER_STATUS.DELIVERED, createdAt: { $gte: from }, driverId: { $ne: null } } },
        {
          $group: {
            _id:       '$driverId',
            deliveries: { $sum: 1 },
            earnings:   { $sum: '$pricing.deliveryFee' },
          },
        },
        { $sort: { deliveries: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'drivers', localField: '_id', foreignField: '_id', as: 'driver' } },
        { $unwind: '$driver' },
        { $lookup: { from: 'users', localField: 'driver.userId', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        {
          $project: {
            firstName:  '$user.profile.firstName',
            lastName:   '$user.profile.lastName',
            rating:     '$driver.rating',
            deliveries: 1,
            earnings:   { $round: ['$earnings', 2] },
          },
        },
      ]),

      Order.aggregate([
        {
          $match: {
            status: ORDER_STATUS.DELIVERED,
            createdAt: { $gte: from },
            'timeline.pickedUpAt': { $exists: true },
            'timeline.deliveredAt': { $exists: true },
          },
        },
        {
          $project: {
            deliveryMinutes: {
              $divide: [
                { $subtract: ['$timeline.deliveredAt', '$timeline.pickedUpAt'] },
                60000,
              ],
            },
          },
        },
        { $group: { _id: null, avg: { $avg: '$deliveryMinutes' } } },
      ]),
    ]);

    return {
      topDrivers: deliveries,
      avgDeliveryTimeMinutes: +(avgDeliveryTime[0]?.avg || 0).toFixed(1),
    };
  },

  /**
   * Cuisine popularity breakdown
   */
  async getCuisineBreakdown(days = 30) {
    const from = new Date(Date.now() - days * 86400000);

    return Order.aggregate([
      { $match: { status: ORDER_STATUS.DELIVERED, createdAt: { $gte: from } } },
      { $lookup: { from: 'restaurants', localField: 'restaurantId', foreignField: '_id', as: 'restaurant' } },
      { $unwind: '$restaurant' },
      { $unwind: '$restaurant.cuisine' },
      { $group: { _id: '$restaurant.cuisine', orders: { $sum: 1 }, revenue: { $sum: '$pricing.total' } } },
      { $sort: { orders: -1 } },
      { $limit: 10 },
    ]);
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function _sumRevenue(match) {
  const result = await Order.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$pricing.total' } } },
  ]);
  return +(result[0]?.total || 0).toFixed(2);
}

async function _cancelRate(from) {
  const [total, cancelled] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: from } }),
    Order.countDocuments({ createdAt: { $gte: from }, status: ORDER_STATUS.CANCELLED }),
  ]);
  if (!total) return 0;
  return +((cancelled / total) * 100).toFixed(1);
}

function _fillDateGaps(from, to, data) {
  const map = {};
  data.forEach(d => { map[d._id] = d; });

  const result = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= to) {
    const key = cursor.toISOString().slice(0, 10);
    result.push(
      map[key] || { _id: key, orders: 0, revenue: 0, avgOrderValue: 0, deliveryFees: 0 }
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

module.exports = analyticsService;

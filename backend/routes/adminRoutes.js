const express = require('express');
const router = express.Router();

const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse, getPagination, buildPaginationMeta } = require('../utils/apiResponse');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const { Order, ORDER_STATUS } = require('../models/Order');
const Driver = require('../models/Driver');

router.use(protect);
router.use(authorize('admin'));

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
router.get('/stats', asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersToday,
    totalRestaurants,
    activeRestaurants,
    totalOrders,
    ordersToday,
    revenueToday,
    revenueWeek,
    activeDrivers,
    pendingRestaurants,
  ] = await Promise.all([
    User.countDocuments({ status: 'active' }),
    User.countDocuments({ createdAt: { $gte: today } }),
    Restaurant.countDocuments(),
    Restaurant.countDocuments({ status: 'active' }),
    Order.countDocuments(),
    Order.countDocuments({ createdAt: { $gte: today } }),
    Order.aggregate([
      { $match: { createdAt: { $gte: today }, status: ORDER_STATUS.DELIVERED } },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: weekStart }, status: ORDER_STATUS.DELIVERED } },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } },
    ]),
    Driver.countDocuments({ status: { $in: ['available', 'busy'] } }),
    Restaurant.countDocuments({ status: 'pending' }),
  ]);

  return ApiResponse.success(res, {
    stats: {
      totalUsers,
      newUsersToday,
      totalRestaurants,
      activeRestaurants,
      totalOrders,
      ordersToday,
      revenueToday: revenueToday[0]?.total || 0,
      revenueWeek: revenueWeek[0]?.total || 0,
      activeDrivers,
      pendingRestaurants,
    },
  });
}));

// ─── User Management ──────────────────────────────────────────────────────────
router.get('/users', asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query.page, req.query.limit);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    filter.$or = [
      { email: new RegExp(req.query.search, 'i') },
      { 'profile.firstName': new RegExp(req.query.search, 'i') },
      { 'profile.lastName': new RegExp(req.query.search, 'i') },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return ApiResponse.paginated(res, users, buildPaginationMeta(total, page, limit));
}));

router.patch('/users/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['active', 'suspended'].includes(status)) {
    return ApiResponse.badRequest(res, 'Status must be active or suspended');
  }

  const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!user) return ApiResponse.notFound(res);

  return ApiResponse.success(res, { user }, `User ${status}`);
}));

// ─── Pending Restaurants ──────────────────────────────────────────────────────
router.get('/restaurants/pending', asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query.page, req.query.limit);

  const [restaurants, total] = await Promise.all([
    Restaurant.find({ status: 'pending' })
      .populate('ownerId', 'profile.firstName profile.lastName email phone')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Restaurant.countDocuments({ status: 'pending' }),
  ]);

  return ApiResponse.paginated(res, restaurants, buildPaginationMeta(total, page, limit));
}));

// ─── Order Overview ───────────────────────────────────────────────────────────
router.get('/orders', asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query.page, req.query.limit);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('customerId', 'profile.firstName profile.lastName')
      .populate('restaurantId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return ApiResponse.paginated(res, orders, buildPaginationMeta(total, page, limit));
}));

// ─── Revenue Analytics ────────────────────────────────────────────────────────
router.get('/analytics/revenue', asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days, 10) || 30;
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const daily = await Order.aggregate([
    {
      $match: {
        status: ORDER_STATUS.DELIVERED,
        'timeline.deliveredAt': { $gte: from },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$timeline.deliveredAt' } },
        orders: { $sum: 1 },
        revenue: { $sum: '$pricing.total' },
        deliveryFees: { $sum: '$pricing.deliveryFee' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return ApiResponse.success(res, { daily, period: `Last ${days} days` });
}));

module.exports = router;

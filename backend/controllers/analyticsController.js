const analyticsService = require('../services/analyticsService');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');

const analyticsController = {
  kpis: asyncHandler(async (req, res) => {
    const data = await analyticsService.getDashboardKPIs();
    return ApiResponse.success(res, data);
  }),

  revenueChart: asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const data = await analyticsService.getRevenueChart(days);
    return ApiResponse.success(res, { chart: data, days });
  }),

  ordersBreakdown: asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const data = await analyticsService.getOrdersBreakdown(days);
    return ApiResponse.success(res, data);
  }),

  topRestaurants: asyncHandler(async (req, res) => {
    const data = await analyticsService.getTopRestaurants(
      parseInt(req.query.limit) || 10,
      parseInt(req.query.days)  || 30
    );
    return ApiResponse.success(res, { restaurants: data });
  }),

  topCustomers: asyncHandler(async (req, res) => {
    const data = await analyticsService.getTopCustomers(
      parseInt(req.query.limit) || 10,
      parseInt(req.query.days)  || 30
    );
    return ApiResponse.success(res, { customers: data });
  }),

  driverStats: asyncHandler(async (req, res) => {
    const data = await analyticsService.getDriverStats(parseInt(req.query.days) || 30);
    return ApiResponse.success(res, data);
  }),

  cuisineBreakdown: asyncHandler(async (req, res) => {
    const data = await analyticsService.getCuisineBreakdown(parseInt(req.query.days) || 30);
    return ApiResponse.success(res, { cuisines: data });
  }),
};

module.exports = analyticsController;

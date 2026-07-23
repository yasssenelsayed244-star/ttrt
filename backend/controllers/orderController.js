const orderService = require('../services/orderService');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');

const orderController = {
  // POST /api/v1/orders
  placeOrder: asyncHandler(async (req, res) => {
    const order = await orderService.placeOrder(req.user._id, req.body);
    return ApiResponse.created(res, { order }, 'Order placed successfully');
  }),

  // GET /api/v1/orders (customer)
  getMyOrders: asyncHandler(async (req, res) => {
    const result = await orderService.getCustomerOrders(req.user._id, req.query);
    return ApiResponse.paginated(res, result.orders, result.pagination);
  }),

  // GET /api/v1/orders/restaurant/:restaurantId (owner)
  getRestaurantOrders: asyncHandler(async (req, res) => {
    const result = await orderService.getRestaurantOrders(req.params.restaurantId, req.query);
    return ApiResponse.paginated(res, result.orders, result.pagination);
  }),

  // GET /api/v1/orders/:id
  getOrder: asyncHandler(async (req, res) => {
    const order = await orderService.getOrder(req.params.id, req.user._id, req.user.role);
    return ApiResponse.success(res, { order });
  }),

  // PATCH /api/v1/orders/:id/status
  updateStatus: asyncHandler(async (req, res) => {
    const order = await orderService.updateStatus(
      req.params.id,
      req.body.status,
      req.user._id,
      req.user.role,
      req.body.note
    );
    return ApiResponse.success(res, { order }, `Order status updated to ${order.status}`);
  }),

  // PATCH /api/v1/orders/:id/cancel
  cancelOrder: asyncHandler(async (req, res) => {
    const order = await orderService.cancelOrder(
      req.params.id,
      req.user._id,
      req.user.role,
      req.body.reason
    );
    return ApiResponse.success(res, { order }, 'Order cancelled');
  }),

  // POST /api/v1/orders/:id/rate
  rateOrder: asyncHandler(async (req, res) => {
    const order = await orderService.rateOrder(req.params.id, req.user._id, req.body);
    return ApiResponse.success(res, { order }, 'Thank you for your feedback!');
  }),

  // GET /api/v1/orders/:id/tracking
  getTracking: asyncHandler(async (req, res) => {
    const tracking = await orderService.getTracking(req.params.id, req.user._id);
    return ApiResponse.success(res, { tracking });
  }),
};

module.exports = orderController;

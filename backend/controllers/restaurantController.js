const restaurantService = require('../services/restaurantService');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');

const restaurantController = {
  // ─── Restaurants ───────────────────────────────────────────────────────────

  getAll: asyncHandler(async (req, res) => {
    const result = await restaurantService.getAll(req.query);
    return ApiResponse.paginated(res, result.restaurants, result.pagination);
  }),

  getById: asyncHandler(async (req, res) => {
    const restaurant = await restaurantService.getById(req.params.id);
    return ApiResponse.success(res, { restaurant });
  }),

  getMenu: asyncHandler(async (req, res) => {
    const menu = await restaurantService.getMenu(req.params.id);
    return ApiResponse.success(res, { menu });
  }),

  create: asyncHandler(async (req, res) => {
    const restaurant = await restaurantService.create(req.user._id, req.body);
    return ApiResponse.created(res, { restaurant }, 'Restaurant submitted for approval');
  }),

  update: asyncHandler(async (req, res) => {
    const restaurant = await restaurantService.update(
      req.params.id,
      req.user._id,
      req.body,
      req.user.role === 'admin'
    );
    return ApiResponse.success(res, { restaurant }, 'Restaurant updated');
  }),

  delete: asyncHandler(async (req, res) => {
    await restaurantService.delete(
      req.params.id,
      req.user._id,
      req.user.role === 'admin'
    );
    return ApiResponse.success(res, null, 'Restaurant deactivated');
  }),

  toggleOpen: asyncHandler(async (req, res) => {
    const restaurant = await restaurantService.toggleOpen(req.params.id, req.user._id);
    return ApiResponse.success(
      res,
      { isOpen: restaurant.isOpen },
      `Restaurant is now ${restaurant.isOpen ? 'open' : 'closed'}`
    );
  }),

  getMyRestaurants: asyncHandler(async (req, res) => {
    const restaurants = await restaurantService.getByOwner(req.user._id);
    return ApiResponse.success(res, { restaurants });
  }),

  // ─── Admin ─────────────────────────────────────────────────────────────────

  approve: asyncHandler(async (req, res) => {
    const { status, reason } = req.body;
    const restaurant = await restaurantService.approve(req.params.id, status, reason);
    return ApiResponse.success(res, { restaurant }, `Restaurant ${status}`);
  }),

  // ─── Menu Categories ───────────────────────────────────────────────────────

  createCategory: asyncHandler(async (req, res) => {
    const { restaurantId, ...data } = req.body;
    const category = await restaurantService.createCategory(
      restaurantId,
      req.user._id,
      data,
      req.user.role === 'admin'
    );
    return ApiResponse.created(res, { category });
  }),

  updateCategory: asyncHandler(async (req, res) => {
    const category = await restaurantService.updateCategory(
      req.params.id,
      req.user._id,
      req.body,
      req.user.role === 'admin'
    );
    return ApiResponse.success(res, { category });
  }),

  deleteCategory: asyncHandler(async (req, res) => {
    await restaurantService.deleteCategory(
      req.params.id,
      req.user._id,
      req.user.role === 'admin'
    );
    return ApiResponse.success(res, null, 'Category deleted');
  }),

  // ─── Menu Items ────────────────────────────────────────────────────────────

  createMenuItem: asyncHandler(async (req, res) => {
    const item = await restaurantService.createMenuItem(
      req.user._id,
      req.body,
      req.user.role === 'admin'
    );
    return ApiResponse.created(res, { item });
  }),

  updateMenuItem: asyncHandler(async (req, res) => {
    const item = await restaurantService.updateMenuItem(
      req.params.id,
      req.user._id,
      req.body,
      req.user.role === 'admin'
    );
    return ApiResponse.success(res, { item });
  }),

  toggleAvailability: asyncHandler(async (req, res) => {
    const item = await restaurantService.toggleAvailability(
      req.params.id,
      req.user._id,
      req.user.role === 'admin'
    );
    return ApiResponse.success(
      res,
      { isAvailable: item.isAvailable },
      `Item is now ${item.isAvailable ? 'available' : 'unavailable'}`
    );
  }),

  deleteMenuItem: asyncHandler(async (req, res) => {
    await restaurantService.deleteMenuItem(
      req.params.id,
      req.user._id,
      req.user.role === 'admin'
    );
    return ApiResponse.success(res, null, 'Menu item deleted');
  }),
};

module.exports = restaurantController;

const cartService = require('../services/cartService');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');

const cartController = {
  getCart: asyncHandler(async (req, res) => {
    const cart = await cartService.getCart(req.user._id);
    return ApiResponse.success(res, { cart });
  }),

  addItem: asyncHandler(async (req, res) => {
    const cart = await cartService.addItem(req.user._id, req.body);
    return ApiResponse.success(res, { cart }, 'Item added to cart');
  }),

  updateItem: asyncHandler(async (req, res) => {
    const cart = await cartService.updateItem(req.user._id, req.params.itemId, req.body.quantity);
    return ApiResponse.success(res, { cart }, 'Cart updated');
  }),

  removeItem: asyncHandler(async (req, res) => {
    const cart = await cartService.removeItem(req.user._id, req.params.itemId);
    return ApiResponse.success(res, { cart }, 'Item removed');
  }),

  clearCart: asyncHandler(async (req, res) => {
    await cartService.clearCart(req.user._id);
    return ApiResponse.success(res, null, 'Cart cleared');
  }),
};

module.exports = cartController;

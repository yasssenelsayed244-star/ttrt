const userService = require('../services/userService');
const walletService = require('../services/walletService');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');
const Joi = require('joi');

const updateProfileSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50),
  lastName:  Joi.string().trim().min(2).max(50),
  phone:     Joi.string().pattern(/^\+?[1-9]\d{7,14}$/),
});

const addressSchema = Joi.object({
  label:        Joi.string().valid('home', 'work', 'other').default('other'),
  customLabel:  Joi.string().max(30),
  street:       Joi.string().required(),
  building:     Joi.string(),
  floor:        Joi.string(),
  apartment:    Joi.string(),
  city:         Joi.string().required(),
  instructions: Joi.string().max(200),
  coordinates:  Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
  }).required(),
  isDefault: Joi.boolean().default(false),
});

const userController = {
  // ─── Profile ────────────────────────────────────────────────────────────────

  getProfile: asyncHandler(async (req, res) => {
    const user = await userService.getProfile(req.user._id);
    return ApiResponse.success(res, { user });
  }),

  updateProfile: asyncHandler(async (req, res) => {
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) return ApiResponse.badRequest(res, error.details[0].message);
    const user = await userService.updateProfile(req.user._id, value);
    return ApiResponse.success(res, { user }, 'Profile updated');
  }),

  deleteAccount: asyncHandler(async (req, res) => {
    await userService.deleteAccount(req.user._id);
    return ApiResponse.success(res, null, 'Account deleted');
  }),

  // ─── Addresses ──────────────────────────────────────────────────────────────

  getAddresses: asyncHandler(async (req, res) => {
    const addresses = await userService.getAddresses(req.user._id);
    return ApiResponse.success(res, { addresses });
  }),

  addAddress: asyncHandler(async (req, res) => {
    const { error, value } = addressSchema.validate(req.body);
    if (error) return ApiResponse.badRequest(res, error.details[0].message);
    const address = await userService.addAddress(req.user._id, value);
    return ApiResponse.created(res, { address });
  }),

  updateAddress: asyncHandler(async (req, res) => {
    const { error, value } = addressSchema.fork(
      ['street', 'city', 'coordinates'],
      f => f.optional()
    ).validate(req.body);
    if (error) return ApiResponse.badRequest(res, error.details[0].message);
    const address = await userService.updateAddress(req.params.id, req.user._id, value);
    return ApiResponse.success(res, { address });
  }),

  deleteAddress: asyncHandler(async (req, res) => {
    await userService.deleteAddress(req.params.id, req.user._id);
    return ApiResponse.success(res, null, 'Address deleted');
  }),

  setDefault: asyncHandler(async (req, res) => {
    const address = await userService.setDefaultAddress(req.params.id, req.user._id);
    return ApiResponse.success(res, { address }, 'Default address updated');
  }),

  // ─── Order History ───────────────────────────────────────────────────────────

  getOrderHistory: asyncHandler(async (req, res) => {
    const result = await userService.getOrderHistory(req.user._id, req.query);
    return ApiResponse.paginated(res, result.orders, result.pagination, 'OK');
  }),

  // ─── Favourites ──────────────────────────────────────────────────────────────

  getFavourites: asyncHandler(async (req, res) => {
    const restaurants = await userService.getFavourites(req.user._id);
    return ApiResponse.success(res, { restaurants });
  }),

  toggleFavourite: asyncHandler(async (req, res) => {
    const result = await userService.toggleFavourite(req.user._id, req.params.restaurantId);
    return ApiResponse.success(res, result, result.isFavourite ? 'Added to favourites' : 'Removed from favourites');
  }),

  // ─── Wallet ──────────────────────────────────────────────────────────────────

  getWallet: asyncHandler(async (req, res) => {
    const wallet = await walletService.getBalance(req.user._id);
    return ApiResponse.success(res, { wallet });
  }),

  getTransactions: asyncHandler(async (req, res) => {
    const result = await walletService.getTransactions(req.user._id, req.query);
    return ApiResponse.paginated(res, result.transactions, result.pagination, `Balance: ${result.balance} EGP`);
  }),

  topUp: asyncHandler(async (req, res) => {
    const { amount } = req.body;
    if (!amount || amount <= 0) return ApiResponse.badRequest(res, 'Valid amount required');
    const result = await walletService.topUp(req.user._id, amount);
    return ApiResponse.success(res, result, `${amount} EGP added to wallet`);
  }),
};

module.exports = userController;

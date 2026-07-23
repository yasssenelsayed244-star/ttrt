const driverService = require('../services/driverService');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');
const Joi = require('joi');

const locationSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
});

const registerSchema = Joi.object({
  vehicle: Joi.object({
    type: Joi.string().valid('motorcycle', 'car', 'bicycle').required(),
    plateNumber: Joi.string().trim().uppercase(),
    color: Joi.string(),
    model: Joi.string(),
  }).required(),
  zone: Joi.string(),
});

const driverController = {
  register: asyncHandler(async (req, res) => {
    const { error } = registerSchema.validate(req.body);
    if (error) return ApiResponse.badRequest(res, error.details[0].message);

    const driver = await driverService.register(req.user._id, req.body);
    return ApiResponse.created(res, { driver }, 'Driver profile created');
  }),

  getProfile: asyncHandler(async (req, res) => {
    const driver = await driverService.getProfile(req.user._id);
    return ApiResponse.success(res, { driver });
  }),

  updateLocation: asyncHandler(async (req, res) => {
    const { error, value } = locationSchema.validate(req.body);
    if (error) return ApiResponse.badRequest(res, error.details[0].message);

    const location = await driverService.updateLocation(req.user._id, value.lat, value.lng);
    return ApiResponse.success(res, { location });
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const driver = await driverService.toggleStatus(req.user._id, req.body.status);
    return ApiResponse.success(res, { status: driver.status });
  }),

  getDeliveries: asyncHandler(async (req, res) => {
    const result = await driverService.getDeliveries(req.user._id, req.query);
    return ApiResponse.paginated(res, result.orders, result.pagination);
  }),

  getEarnings: asyncHandler(async (req, res) => {
    const earnings = await driverService.getEarnings(req.user._id);
    return ApiResponse.success(res, { earnings });
  }),

  // Admin
  listAll: asyncHandler(async (req, res) => {
    const result = await driverService.listAll(req.query);
    return ApiResponse.paginated(res, result.drivers, result.pagination);
  }),
};

module.exports = driverController;

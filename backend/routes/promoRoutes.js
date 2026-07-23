const express = require('express');
const router = express.Router();
const promoService = require('../services/promoService');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const Joi = require('joi');

const createPromoSchema = Joi.object({
  code: Joi.string().trim().uppercase().min(3).max(20).required(),
  type: Joi.string().valid('percentage', 'fixed').required(),
  value: Joi.number().min(0).required(),
  minOrderAmount: Joi.number().min(0).default(0),
  maxDiscount: Joi.number().min(0),
  maxUses: Joi.number().integer().min(1),
  maxUsesPerUser: Joi.number().integer().min(1).default(1),
  applicableRestaurants: Joi.array().items(Joi.string().hex().length(24)).default([]),
  startsAt: Joi.date().default(Date.now),
  expiresAt: Joi.date().greater('now').required(),
  description: Joi.string().max(200),
  isActive: Joi.boolean().default(true),
});

router.use(protect);

router.post('/validate', authorize('customer'), asyncHandler(async (req, res) => {
  const { code, subtotal, restaurantId } = req.body;
  if (!code || !subtotal || !restaurantId) return ApiResponse.badRequest(res, 'code, subtotal, and restaurantId are required');
  const result = await promoService.validate(code, req.user._id, subtotal, restaurantId);
  return ApiResponse.success(res, result, `Code applied: -${result.discount} EGP`);
}));

router.get('/', authorize('admin'), asyncHandler(async (req, res) => {
  const promos = await promoService.list(req.query);
  return ApiResponse.success(res, { promos });
}));

router.post('/', authorize('admin'), asyncHandler(async (req, res) => {
  const { error, value } = createPromoSchema.validate(req.body);
  if (error) return ApiResponse.badRequest(res, error.details[0].message);
  const promo = await promoService.create(req.user._id, value);
  return ApiResponse.created(res, { promo });
}));

router.patch('/:id/deactivate', authorize('admin'), asyncHandler(async (req, res) => {
  const promo = await promoService.deactivate(req.params.id);
  return ApiResponse.success(res, { promo }, 'Promo code deactivated');
}));

module.exports = router;

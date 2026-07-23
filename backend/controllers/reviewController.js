const reviewService = require('../services/reviewService');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');
const Joi = require('joi');

const createReviewSchema = Joi.object({
  orderId:  Joi.string().hex().length(24).required(),
  rating:   Joi.number().integer().min(1).max(5).required(),
  comment:  Joi.string().trim().max(500),
  tags:     Joi.array().items(
    Joi.string().valid('fast_delivery','good_packaging','hot_food','fresh','accurate_order','friendly_driver')
  ).default([]),
  images:   Joi.array().items(Joi.string().uri()).max(3).default([]),
});

const reviewController = {
  create: asyncHandler(async (req, res) => {
    const { error, value } = createReviewSchema.validate(req.body);
    if (error) return ApiResponse.badRequest(res, error.details[0].message);
    const review = await reviewService.create(req.user._id, value);
    return ApiResponse.created(res, { review });
  }),

  getForRestaurant: asyncHandler(async (req, res) => {
    const result = await reviewService.getForRestaurant(req.params.restaurantId, req.query);
    return ApiResponse.paginated(res, result.reviews, result.pagination, 'OK');
  }),

  getMyReviews: asyncHandler(async (req, res) => {
    const reviews = await reviewService.getMyReviews(req.user._id);
    return ApiResponse.success(res, { reviews });
  }),

  replyToReview: asyncHandler(async (req, res) => {
    const { text } = req.body;
    if (!text?.trim()) return ApiResponse.badRequest(res, 'Reply text is required');
    const review = await reviewService.replyToReview(req.params.id, req.user._id, text.trim());
    return ApiResponse.success(res, { review }, 'Reply added');
  }),

  flagReview: asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const review = await reviewService.flagReview(req.params.id, reason);
    return ApiResponse.success(res, { review }, 'Review hidden');
  }),
};

module.exports = reviewController;

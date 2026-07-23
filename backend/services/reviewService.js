const Review = require('../models/Review');
const Restaurant = require('../models/Restaurant');
const { Order, ORDER_STATUS } = require('../models/Order');
const { AppError } = require('../middleware/errorHandler');
const { getPagination, buildPaginationMeta } = require('../utils/apiResponse');
const { deleteCacheByPattern } = require('../config/redis');

const reviewService = {
  /**
   * Create review — one per delivered order
   */
  async create(customerId, { orderId, rating, comment, tags = [], images = [] }) {
    const order = await Order.findOne({ _id: orderId, customerId });
    if (!order) throw new AppError('Order not found', 404);
    if (order.status !== ORDER_STATUS.DELIVERED) {
      throw new AppError('Can only review delivered orders', 400);
    }

    const existing = await Review.findOne({ orderId });
    if (existing) throw new AppError('You already reviewed this order', 409);

    const review = await Review.create({
      restaurantId: order.restaurantId,
      customerId,
      orderId,
      rating,
      comment,
      tags,
      images,
    });

    // Update restaurant rating
    const restaurant = await Restaurant.findById(order.restaurantId);
    if (restaurant) await restaurant.updateRating(rating);

    await deleteCacheByPattern(`restaurants:${order.restaurantId}`);
    return review.populate('customerId', 'profile.firstName profile.lastName profile.avatar');
  },

  /**
   * Get reviews for a restaurant with pagination + rating breakdown
   */
  async getForRestaurant(restaurantId, query) {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter = { restaurantId, isVisible: true };
    if (query.rating) filter.rating = Number(query.rating);

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      highest: { rating: -1 },
      lowest: { rating: 1 },
    };
    const sort = sortMap[query.sort] || { createdAt: -1 };

    const [reviews, total, breakdown] = await Promise.all([
      Review.find(filter)
        .populate('customerId', 'profile.firstName profile.lastName profile.avatar')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter),
      Review.aggregate([
        { $match: { restaurantId: require('mongoose').Types.ObjectId.createFromHexString(restaurantId), isVisible: true } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
      ]),
    ]);

    const ratingBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    breakdown.forEach(b => { ratingBreakdown[b._id] = b.count; });

    return {
      reviews,
      pagination: buildPaginationMeta(total, page, limit),
      ratingBreakdown,
    };
  },

  /**
   * Owner replies to a review
   */
  async replyToReview(reviewId, ownerId, text) {
    const review = await Review.findById(reviewId).populate('restaurantId', 'ownerId');
    if (!review) throw new AppError('Review not found', 404);
    if (review.restaurantId.ownerId.toString() !== ownerId.toString()) {
      throw new AppError('Not authorized', 403);
    }
    if (review.ownerReply?.text) throw new AppError('Already replied to this review', 409);

    review.ownerReply = { text, repliedAt: new Date() };
    await review.save();
    return review;
  },

  /**
   * Admin: flag / hide a review
   */
  async flagReview(reviewId, reason) {
    const review = await Review.findByIdAndUpdate(
      reviewId,
      { flagged: true, flagReason: reason, isVisible: false },
      { new: true }
    );
    if (!review) throw new AppError('Review not found', 404);
    return review;
  },

  async getMyReviews(customerId) {
    return Review.find({ customerId })
      .populate('restaurantId', 'name logo')
      .sort({ createdAt: -1 })
      .lean();
  },
};

module.exports = reviewService;

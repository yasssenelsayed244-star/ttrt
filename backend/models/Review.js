const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true, // one review per order
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    images: [String], // Cloudinary URLs
    tags: [{ type: String, enum: ['fast_delivery', 'good_packaging', 'hot_food', 'fresh', 'accurate_order', 'friendly_driver'] }],
    // Owner reply
    ownerReply: {
      text: String,
      repliedAt: Date,
    },
    isVisible: { type: Boolean, default: true },
    // Admin can hide abusive reviews
    flagged: { type: Boolean, default: false },
    flagReason: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

reviewSchema.index({ restaurantId: 1, createdAt: -1 });
reviewSchema.index({ customerId: 1 });
reviewSchema.index({ restaurantId: 1, rating: -1 });

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;

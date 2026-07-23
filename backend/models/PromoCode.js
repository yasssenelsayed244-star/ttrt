const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    // Constraints
    minOrderAmount: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: null },   // cap for percentage discounts
    maxUses: { type: Number, default: null },        // null = unlimited
    usedCount: { type: Number, default: 0 },
    // Per-user limit
    maxUsesPerUser: { type: Number, default: 1 },
    // Scope
    applicableRestaurants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' }], // empty = all
    // Users who used this code
    usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Validity
    startsAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    description: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

promoCodeSchema.index({ expiresAt: 1, isActive: 1 });

// Virtual: is currently valid
promoCodeSchema.virtual('isValid').get(function () {
  const now = new Date();
  return (
    this.isActive &&
    now >= this.startsAt &&
    now <= this.expiresAt &&
    (this.maxUses === null || this.usedCount < this.maxUses)
  );
});

/**
 * Calculate discount amount for a given order subtotal
 */
promoCodeSchema.methods.calculateDiscount = function (subtotal) {
  if (this.type === 'fixed') return Math.min(this.value, subtotal);
  const raw = (subtotal * this.value) / 100;
  return this.maxDiscount ? Math.min(raw, this.maxDiscount) : raw;
};

const PromoCode = mongoose.model('PromoCode', promoCodeSchema);
module.exports = PromoCode;

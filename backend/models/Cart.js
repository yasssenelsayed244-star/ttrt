const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true,
    },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    options: [
      {
        optionId: mongoose.Schema.Types.ObjectId,
        name: String,
        choice: String,
        extraPrice: { type: Number, default: 0 },
        _id: false,
      },
    ],
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const cartSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // one active cart per customer
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
    },
    items: [cartItemSchema],
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  },
  { timestamps: true }
);

// TTL index - MongoDB auto-deletes expired carts
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Refresh cart TTL on update
cartSchema.methods.refreshExpiry = async function () {
  this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return this.save();
};

// Check if cart is empty
cartSchema.virtual('isEmpty').get(function () {
  return this.items.length === 0;
});

const Cart = mongoose.model('Cart', cartSchema);
module.exports = Cart;

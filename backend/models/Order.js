const mongoose = require('mongoose');

// ─── Order Status Constants ───────────────────────────────────────────────────

const ORDER_STATUS = {
  PLACED: 'PLACED',
  CONFIRMED: 'CONFIRMED',
  PREPARING: 'PREPARING',
  READY: 'READY',
  PICKED_UP: 'PICKED_UP',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
};

// Valid state transitions per role
const STATUS_TRANSITIONS = {
  [ORDER_STATUS.PLACED]: {
    next: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
    roles: { CONFIRMED: 'restaurant_owner', CANCELLED: ['customer', 'restaurant_owner', 'admin'] },
  },
  [ORDER_STATUS.CONFIRMED]: {
    next: [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
    roles: { PREPARING: 'restaurant_owner', CANCELLED: ['restaurant_owner', 'admin'] },
  },
  [ORDER_STATUS.PREPARING]: {
    next: [ORDER_STATUS.READY],
    roles: { READY: 'restaurant_owner' },
  },
  [ORDER_STATUS.READY]: {
    next: [ORDER_STATUS.PICKED_UP],
    roles: { PICKED_UP: 'driver' },
  },
  [ORDER_STATUS.PICKED_UP]: {
    next: [ORDER_STATUS.DELIVERED],
    roles: { DELIVERED: 'driver' },
  },
  [ORDER_STATUS.DELIVERED]: {
    next: [],
    roles: {},
  },
  [ORDER_STATUS.CANCELLED]: {
    next: [ORDER_STATUS.REFUNDED],
    roles: { REFUNDED: 'admin' },
  },
};

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const orderItemSchema = new mongoose.Schema(
  {
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    options: [
      {
        name: String,
        choice: String,
        extraPrice: { type: Number, default: 0 },
        _id: false,
      },
    ],
    totalPrice: { type: Number, required: true },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: Object.values(ORDER_STATUS) },
    timestamp: { type: Date, default: Date.now },
    note: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const ratingSchema = new mongoose.Schema(
  {
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─── Order Schema ─────────────────────────────────────────────────────────────

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
    },

    items: [orderItemSchema],

    pricing: {
      subtotal: { type: Number, required: true },
      deliveryFee: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      total: { type: Number, required: true },
    },

    deliveryAddress: {
      street: String,
      building: String,
      floor: String,
      apartment: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
      instructions: String,
    },

    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PLACED,
    },
    statusHistory: [statusHistorySchema],

    payment: {
      method: {
        type: String,
        enum: ['cash', 'card', 'wallet'],
        required: true,
      },
      status: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending',
      },
      transactionId: String,
    },

    timeline: {
      placedAt: { type: Date, default: Date.now },
      confirmedAt: Date,
      preparedAt: Date,
      pickedUpAt: Date,
      deliveredAt: Date,
      cancelledAt: Date,
    },

    rating: {
      customerToRestaurant: ratingSchema,
      customerToDriver: ratingSchema,
      driverToCustomer: ratingSchema,
    },

    cancellationReason: String,
    notes: String, // special instructions from customer
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Indexes
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, status: 1 });
orderSchema.index({ driverId: 1, status: 1 });
orderSchema.index({ status: 1, createdAt: -1 });

// Auto-generate order number (QB-2026-000001)
orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const count = await this.constructor.countDocuments();
    const year = new Date().getFullYear();
    this.orderNumber = `QB-${year}-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Method: validate status transition
orderSchema.methods.canTransitionTo = function (newStatus, userRole) {
  const transition = STATUS_TRANSITIONS[this.status];
  if (!transition) return false;
  if (!transition.next.includes(newStatus)) return false;

  const allowedRole = transition.roles[newStatus];
  if (!allowedRole) return false;

  if (Array.isArray(allowedRole)) {
    return allowedRole.includes(userRole);
  }
  return allowedRole === userRole || userRole === 'admin';
};

// Method: apply status transition
orderSchema.methods.transitionTo = async function (newStatus, userId, note = '') {
  const timelineMap = {
    [ORDER_STATUS.CONFIRMED]: 'confirmedAt',
    [ORDER_STATUS.PREPARING]: null,
    [ORDER_STATUS.READY]: 'preparedAt',
    [ORDER_STATUS.PICKED_UP]: 'pickedUpAt',
    [ORDER_STATUS.DELIVERED]: 'deliveredAt',
    [ORDER_STATUS.CANCELLED]: 'cancelledAt',
  };

  this.status = newStatus;
  this.statusHistory.push({ status: newStatus, updatedBy: userId, note });

  const timelineField = timelineMap[newStatus];
  if (timelineField) {
    this.timeline[timelineField] = new Date();
  }

  return this.save();
};

const Order = mongoose.model('Order', orderSchema);
module.exports = { Order, ORDER_STATUS, STATUS_TRANSITIONS };

const mongoose = require('mongoose');

const dayScheduleSchema = new mongoose.Schema(
  {
    open: String,   // "09:00"
    close: String,  // "22:00"
    isOpen: { type: Boolean, default: true },
  },
  { _id: false }
);

const restaurantSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    description: String,
    logo: String,
    coverImage: String,
    cuisine: [{ type: String, lowercase: true }],

    address: {
      street: String,
      city: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },

    // GeoJSON for MongoDB geospatial queries
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },

    contact: {
      phone: String,
      email: { type: String, lowercase: true },
    },

    operatingHours: {
      monday: dayScheduleSchema,
      tuesday: dayScheduleSchema,
      wednesday: dayScheduleSchema,
      thursday: dayScheduleSchema,
      friday: dayScheduleSchema,
      saturday: dayScheduleSchema,
      sunday: dayScheduleSchema,
    },

    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },

    deliveryFee: { type: Number, default: 0 },
    minimumOrder: { type: Number, default: 0 },
    estimatedDeliveryTime: { type: Number, default: 30 }, // minutes

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'active', 'inactive'],
      default: 'pending',
    },
    isOpen: { type: Boolean, default: false },

    menuCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MenuCategory' }],

    rejectionReason: String, // Admin rejection reason
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Geospatial index for nearby restaurant queries
restaurantSchema.index({ location: '2dsphere' });
restaurantSchema.index({ status: 1, isOpen: 1 });
restaurantSchema.index({ cuisine: 1 });
restaurantSchema.index({ 'rating.average': -1 });

// Auto-generate slug from name
restaurantSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  // Sync GeoJSON location from address coordinates
  if (this.address?.coordinates?.lat && this.address?.coordinates?.lng) {
    this.location = {
      type: 'Point',
      coordinates: [this.address.coordinates.lng, this.address.coordinates.lat],
    };
  }

  next();
});

// Method: update rating after new review
restaurantSchema.methods.updateRating = async function (newRating) {
  const total = this.rating.average * this.rating.count + newRating;
  this.rating.count += 1;
  this.rating.average = +(total / this.rating.count).toFixed(2);
  await this.save();
};

// Check if currently open based on operating hours
restaurantSchema.methods.isCurrentlyOpen = function () {
  const now = new Date();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = days[now.getDay()];
  const schedule = this.operatingHours?.[today];

  if (!schedule || !schedule.isOpen) return false;

  const [openH, openM] = schedule.open.split(':').map(Number);
  const [closeH, closeM] = schedule.close.split(':').map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
};

const Restaurant = mongoose.model('Restaurant', restaurantSchema);
module.exports = Restaurant;

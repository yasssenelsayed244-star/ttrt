const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    vehicle: {
      type: {
        type: String,
        enum: ['motorcycle', 'car', 'bicycle'],
        required: true,
      },
      plateNumber: { type: String, uppercase: true, trim: true },
      color: String,
      model: String,
    },
    documents: {
      idCard: String,          // Cloudinary URL
      license: String,
      vehicleRegistration: String,
      isVerified: { type: Boolean, default: false },
    },
    currentLocation: {
      coordinates: {
        lat: Number,
        lng: Number,
      },
      updatedAt: Date,
    },
    // GeoJSON for MongoDB geospatial queries
    geoLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },
    status: {
      type: String,
      enum: ['offline', 'available', 'busy', 'on_break'],
      default: 'offline',
    },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
    totalDeliveries: { type: Number, default: 0 },
    earnings: {
      balance: { type: Number, default: 0 },      // withdrawable balance
      totalEarned: { type: Number, default: 0 },  // lifetime earnings
    },
    zone: String,   // delivery zone (e.g., 'cairo_west', 'nasr_city')
    activeOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Geospatial index for nearby driver queries
driverSchema.index({ geoLocation: '2dsphere' });
driverSchema.index({ status: 1 });
driverSchema.index({ zone: 1, status: 1 });

// Sync geoLocation on location update
driverSchema.methods.updateLocation = async function (lat, lng) {
  this.currentLocation = { coordinates: { lat, lng }, updatedAt: new Date() };
  this.geoLocation = { type: 'Point', coordinates: [lng, lat] };
  return this.save();
};

// Update rating after delivery
driverSchema.methods.updateRating = async function (newRating) {
  const total = this.rating.average * this.rating.count + newRating;
  this.rating.count += 1;
  this.rating.average = +(total / this.rating.count).toFixed(2);
  await this.save();
};

const Driver = mongoose.model('Driver', driverSchema);
module.exports = Driver;

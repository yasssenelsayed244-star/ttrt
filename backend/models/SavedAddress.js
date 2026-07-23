const mongoose = require('mongoose');

const savedAddressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    label: {
      type: String,
      enum: ['home', 'work', 'other'],
      default: 'other',
    },
    customLabel: String, // if label = 'other'
    street: { type: String, required: true },
    building: String,
    floor: String,
    apartment: String,
    city: { type: String, required: true },
    instructions: String,
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Enforce max 5 saved addresses per user (checked in service)
savedAddressSchema.index({ userId: 1, isDefault: 1 });

const SavedAddress = mongoose.model('SavedAddress', savedAddressSchema);
module.exports = SavedAddress;

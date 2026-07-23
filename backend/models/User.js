const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const addressSchema = new mongoose.Schema(
  {
    street: String,
    city: String,
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      unique: true,
      sparse: true, // allows null/undefined for phone-only users
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      minlength: 8,
      select: false, // never returned by default
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['customer', 'restaurant_owner', 'driver', 'admin'],
      default: 'customer',
    },
    profile: {
      firstName: { type: String, trim: true },
      lastName: { type: String, trim: true },
      avatar: String,
      address: addressSchema,
    },
    // Verification
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    phoneOTP: { type: String, select: false },
    phoneOTPExpires: { type: Date, select: false },
    // Password Reset
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    // Refresh Token (stored hashed)
    refreshTokens: { type: [String], select: false },
    // Account Status
    status: {
      type: String,
      enum: ['active', 'suspended', 'deleted'],
      default: 'active',
    },
    lastLoginAt: Date,
    favourites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
userSchema.index({ role: 1, status: 1 });

// Virtual: full name
userSchema.virtual('fullName').get(function () {
  if (this.profile?.firstName && this.profile?.lastName) {
    return `${this.profile.firstName} ${this.profile.lastName}`;
  }
  return this.profile?.firstName || '';
});

// Virtual: isVerified (either email or phone)
userSchema.virtual('isVerified').get(function () {
  return this.isEmailVerified || this.isPhoneVerified;
});

// Pre-save: hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method: compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method: safe user object (no sensitive fields)
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshTokens;
  delete obj.emailVerificationToken;
  delete obj.phoneOTP;
  delete obj.passwordResetToken;
  return obj;
};

// Soft delete
userSchema.methods.softDelete = async function () {
  this.status = 'deleted';
  this.email = `deleted_${Date.now()}_${this.email}`;
  await this.save();
};

const User = mongoose.model('User', userSchema);
module.exports = User;

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const config = require('../config/env');
const { AppError } = require('../middleware/errorHandler');
const { generateOTP, generateSecureToken, getOTPExpiry } = require('../utils/generateOTP');
const { setCache, getCache, deleteCache } = require('../config/redis');
const logger = require('../utils/logger');

// ─── Token Generation ─────────────────────────────────────────────────────────

const generateAccessToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
};

const generateTokenPair = (userId, role) => ({
  accessToken: generateAccessToken(userId, role),
  refreshToken: generateRefreshToken(userId),
});

// ─── Auth Service ─────────────────────────────────────────────────────────────

const authService = {
  /**
   * Register a new user
   */
  async register(data) {
    const { email, password, phone, firstName, lastName, role } = data;

    // Check if email/phone already exists
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) throw new AppError('Email already registered', 409);
    }

    if (phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) throw new AppError('Phone number already registered', 409);
    }

    const user = await User.create({
      email,
      password,
      phone,
      role,
      profile: { firstName, lastName },
    });

    // Send verification
    if (email) await this.sendEmailVerification(user);
    if (phone) await this.sendPhoneOTP(user);

    const tokens = generateTokenPair(user._id, user.role);

    // Store refresh token (hashed)
    await this.storeRefreshToken(user, tokens.refreshToken);

    return { user: user.toSafeObject(), tokens };
  },

  /**
   * Login with email or phone + password
   */
  async login({ email, phone, password }) {
    const query = email ? { email } : { phone };
    const user = await User.findOne(query).select('+password +refreshTokens');

    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('Invalid credentials', 401);
    }

    if (user.status !== 'active') {
      throw new AppError('Account is suspended', 403);
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const tokens = generateTokenPair(user._id, user.role);
    await this.storeRefreshToken(user, tokens.refreshToken);

    return { user: user.toSafeObject(), tokens };
  },

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(refreshToken) {
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    } catch (_) {
      throw new AppError('Invalid refresh token', 401);
    }

    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (!user) throw new AppError('User not found', 401);

    // Verify refresh token is stored (rotation check)
    const hashedInput = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const isValid = user.refreshTokens?.some(
      (t) => t === hashedInput
    );
    if (!isValid) throw new AppError('Refresh token revoked', 401);

    // Rotate: remove old, issue new
    user.refreshTokens = user.refreshTokens.filter((t) => t !== hashedInput);
    const tokens = generateTokenPair(user._id, user.role);
    await this.storeRefreshToken(user, tokens.refreshToken);

    return { user: user.toSafeObject(), tokens };
  },

  /**
   * Logout - revoke refresh token
   */
  async logout(user, refreshToken) {
    if (!refreshToken) return;

    const hashed = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await User.findByIdAndUpdate(user._id, {
      $pull: { refreshTokens: hashed },
    });
  },

  /**
   * Logout from all devices
   */
  async logoutAll(userId) {
    await User.findByIdAndUpdate(userId, { refreshTokens: [] });
  },

  /**
   * Initiate forgot password flow
   */
  async forgotPassword(email) {
    const user = await User.findOne({ email });
    // Always return success to prevent email enumeration
    if (!user) return;

    const token = generateSecureToken();
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = getOTPExpiry(60); // 1 hour
    await user.save({ validateBeforeSave: false });

    // Cache token for quick lookup
    await setCache(`pwd_reset:${hashedToken}`, user._id.toString(), 3600);

    // TODO: send email with token
    logger.info(`Password reset token for ${email}: ${token}`);

    return token; // Only in dev; real app sends via email
  },

  /**
   * Reset password with token
   */
  async resetPassword(token, newPassword) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) throw new AppError('Invalid or expired reset token', 400);

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokens = []; // Invalidate all sessions
    await user.save();

    await deleteCache(`pwd_reset:${hashedToken}`);

    const tokens = generateTokenPair(user._id, user.role);
    await this.storeRefreshToken(user, tokens.refreshToken);

    return { user: user.toSafeObject(), tokens };
  },

  /**
   * Change password (authenticated)
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');
    if (!user) throw new AppError('User not found', 404);

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) throw new AppError('Current password is incorrect', 401);

    user.password = newPassword;
    user.refreshTokens = []; // Logout all devices
    await user.save();
  },

  /**
   * Send phone OTP
   */
  async sendPhoneOTP(user) {
    const otp = generateOTP(6);
    const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');

    user.phoneOTP = hashedOTP;
    user.phoneOTPExpires = getOTPExpiry(10);
    await user.save({ validateBeforeSave: false });

    // Cache for quick verification
    await setCache(`phone_otp:${user._id}`, hashedOTP, 600);

    // TODO: send SMS via Twilio
    logger.info(`OTP for ${user.phone}: ${otp}`);

    return otp; // Only in dev
  },

  /**
   * Verify phone OTP
   */
  async verifyPhoneOTP(phone, otp) {
    const user = await User.findOne({ phone }).select('+phoneOTP +phoneOTPExpires');
    if (!user) throw new AppError('User not found', 404);

    const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');

    if (
      user.phoneOTP !== hashedOTP ||
      !user.phoneOTPExpires ||
      user.phoneOTPExpires < Date.now()
    ) {
      throw new AppError('Invalid or expired OTP', 400);
    }

    user.isPhoneVerified = true;
    user.phoneOTP = undefined;
    user.phoneOTPExpires = undefined;
    await user.save({ validateBeforeSave: false });

    await deleteCache(`phone_otp:${user._id}`);

    return user.toSafeObject();
  },

  // ─── Helpers ───────────────────────────────────────────────────────────────

  async storeRefreshToken(user, refreshToken) {
    const hashed = crypto.createHash('sha256').update(refreshToken).digest('hex');
    // Keep last 5 refresh tokens (multi-device support)
    const tokens = user.refreshTokens || [];
    if (tokens.length >= 5) tokens.shift();
    tokens.push(hashed);
    await User.findByIdAndUpdate(user._id, { refreshTokens: tokens });
  },

  async sendEmailVerification(user) {
    const token = generateSecureToken();
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = getOTPExpiry(24 * 60); // 24 hours
    await user.save({ validateBeforeSave: false });

    // TODO: send email
    logger.info(`Email verification token for ${user.email}: ${token}`);
    return token;
  },

  async verifyEmail(token) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) throw new AppError('Invalid or expired verification token', 400);

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return user.toSafeObject();
  },
};

module.exports = authService;

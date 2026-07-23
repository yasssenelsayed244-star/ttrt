const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');

/**
 * Protect route - verify access token
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Support both Authorization header and cookie
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return ApiResponse.unauthorized(res, 'Access token required');
  }

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);

    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (!user) {
      return ApiResponse.unauthorized(res, 'User no longer exists');
    }

    if (user.status !== 'active') {
      return ApiResponse.unauthorized(res, 'Account is suspended or deleted');
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return ApiResponse.unauthorized(res, 'Access token expired');
    }
    return ApiResponse.unauthorized(res, 'Invalid access token');
  }
});

/**
 * Optionally authenticate (doesn't block if no token)
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);
    const user = await User.findById(decoded.id);
    if (user?.status === 'active') req.user = user;
  } catch (_) {
    // Silent fail for optional auth
  }

  next();
});

module.exports = { protect, optionalAuth };

const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const authController = {
  /**
   * POST /api/v1/auth/register
   */
  register: asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);

    res.cookie('refreshToken', result.tokens.refreshToken, COOKIE_OPTIONS);

    return ApiResponse.created(res, {
      user: result.user,
      accessToken: result.tokens.accessToken,
      ...(req.headers['x-client-type'] === 'mobile'
        ? { refreshToken: result.tokens.refreshToken }
        : {}),
    }, 'Registration successful. Please verify your account.');
  }),

  /**
   * POST /api/v1/auth/login
   */
  login: asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);

    res.cookie('refreshToken', result.tokens.refreshToken, COOKIE_OPTIONS);

    return ApiResponse.success(res, {
      user: result.user,
      accessToken: result.tokens.accessToken,
      // Mobile has no cookie jar to rely on, so it identifies itself with
      // this header and gets the refresh token back in the JSON body instead.
      // Web clients never send this header and never see the token in JS.
      ...(req.headers['x-client-type'] === 'mobile'
        ? { refreshToken: result.tokens.refreshToken }
        : {}),
    }, 'Login successful');
  }),

  /**
   * POST /api/v1/auth/refresh
   */
  refreshTokens: asyncHandler(async (req, res) => {
    // Support cookie or body
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    if (!refreshToken) {
      return ApiResponse.unauthorized(res, 'Refresh token required');
    }

    const result = await authService.refreshTokens(refreshToken);

    res.cookie('refreshToken', result.tokens.refreshToken, COOKIE_OPTIONS);

    return ApiResponse.success(res, {
      accessToken: result.tokens.accessToken,
      ...(req.headers['x-client-type'] === 'mobile'
        ? { refreshToken: result.tokens.refreshToken }
        : {}),
    }, 'Token refreshed');
  }),

  /**
   * POST /api/v1/auth/logout
   */
  logout: asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    await authService.logout(req.user, refreshToken);
    res.clearCookie('refreshToken');
    return ApiResponse.success(res, null, 'Logged out successfully');
  }),

  /**
   * POST /api/v1/auth/logout-all
   */
  logoutAll: asyncHandler(async (req, res) => {
    await authService.logoutAll(req.user._id);
    res.clearCookie('refreshToken');
    return ApiResponse.success(res, null, 'Logged out from all devices');
  }),

  /**
   * GET /api/v1/auth/me
   */
  getMe: asyncHandler(async (req, res) => {
    return ApiResponse.success(res, { user: req.user.toSafeObject() });
  }),

  /**
   * POST /api/v1/auth/forgot-password
   */
  forgotPassword: asyncHandler(async (req, res) => {
    await authService.forgotPassword(req.body.email);
    // Always return success to prevent email enumeration
    return ApiResponse.success(
      res,
      null,
      'If that email is registered, a reset link has been sent'
    );
  }),

  /**
   * POST /api/v1/auth/reset-password
   */
  resetPassword: asyncHandler(async (req, res) => {
    const { token, password } = req.body;
    const result = await authService.resetPassword(token, password);

    res.cookie('refreshToken', result.tokens.refreshToken, COOKIE_OPTIONS);

    return ApiResponse.success(res, {
      user: result.user,
      accessToken: result.tokens.accessToken,
    }, 'Password reset successful');
  }),

  /**
   * PATCH /api/v1/auth/change-password
   */
  changePassword: asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user._id, currentPassword, newPassword);
    res.clearCookie('refreshToken');
    return ApiResponse.success(res, null, 'Password changed. Please login again.');
  }),

  /**
   * POST /api/v1/auth/verify-email
   */
  verifyEmail: asyncHandler(async (req, res) => {
    const user = await authService.verifyEmail(req.query.token);
    return ApiResponse.success(res, { user }, 'Email verified successfully');
  }),

  /**
   * POST /api/v1/auth/send-otp
   */
  sendOTP: asyncHandler(async (req, res) => {
    await authService.sendPhoneOTP(req.user);
    return ApiResponse.success(res, null, 'OTP sent to your phone number');
  }),

  /**
   * POST /api/v1/auth/verify-phone
   */
  verifyPhone: asyncHandler(async (req, res) => {
    const { phone, otp } = req.body;
    const user = await authService.verifyPhoneOTP(phone, otp);
    return ApiResponse.success(res, { user }, 'Phone verified successfully');
  }),
};

module.exports = authController;

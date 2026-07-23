const logger = require('../utils/logger');
const config = require('../config/env');

// Custom application error class
class AppError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Error Normalizers ────────────────────────────────────────────────────────

const handleCastError = (err) =>
  new AppError(`Invalid value for field: ${err.path}`, 400);

const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  return new AppError(`'${value}' is already taken for ${field}`, 409);
};

const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map((e) => ({
    field: e.path,
    message: e.message,
  }));
  return new AppError('Validation failed', 400, errors);
};

const handleJWTError = () => new AppError('Invalid token', 401);
const handleJWTExpiredError = () => new AppError('Token expired', 401);

// ─── Global Error Handler ─────────────────────────────────────────────────────

const errorHandler = (err, req, res, next) => {
  let error = { ...err, message: err.message };

  // Mongoose / DB errors → AppError
  if (err.name === 'CastError') error = handleCastError(err);
  if (err.code === 11000) error = handleDuplicateKeyError(err);
  if (err.name === 'ValidationError') error = handleValidationError(err);
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';

  // Log non-operational errors (bugs)
  if (!error.isOperational) {
    logger.error(`[${req.method}] ${req.path} — ${message}`, {
      stack: err.stack,
      body: req.body,
      user: req.user?.id,
    });
  }

  return res.status(statusCode).json({
    success: false,
    message,
    ...(error.errors && { errors: error.errors }),
    ...(config.env === 'development' && { stack: err.stack }),
  });
};

// 404 handler (placed before errorHandler in app.js)
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

module.exports = { AppError, errorHandler, notFoundHandler };

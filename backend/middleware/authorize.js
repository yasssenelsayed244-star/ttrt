const { ApiResponse } = require('../utils/apiResponse');

/**
 * Restrict route to specific roles
 * Usage: authorize('admin', 'restaurant_owner')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return ApiResponse.unauthorized(res);
    }

    if (!roles.includes(req.user.role)) {
      return ApiResponse.forbidden(
        res,
        `Role '${req.user.role}' is not authorized for this action`
      );
    }

    next();
  };
};

/**
 * Verify the user owns the resource (or is admin)
 * Usage: authorizeOwner('ownerId') — checks req.resource[field] === req.user.id
 */
const authorizeOwner = (ownerField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) return ApiResponse.unauthorized(res);
    if (req.user.role === 'admin') return next();

    const resource = req.resource; // Set by previous middleware
    if (!resource) return ApiResponse.notFound(res);

    const ownerId = resource[ownerField]?.toString();
    if (ownerId !== req.user.id) {
      return ApiResponse.forbidden(res, 'You do not own this resource');
    }

    next();
  };
};

module.exports = { authorize, authorizeOwner };

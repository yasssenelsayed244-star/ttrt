const { ApiResponse } = require('../utils/apiResponse');

/**
 * Validate request using a Joi schema
 * Usage: validate(schema) or validate(schema, 'params')
 */
const validate = (schema, target = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,    // return all errors at once
      stripUnknown: true,   // remove unknown fields
      convert: true,        // auto-convert types
    });

    if (error) {
      const errors = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message.replace(/['"]/g, ''),
      }));
      return ApiResponse.badRequest(res, 'Validation failed', errors);
    }

    req[target] = value; // replace with sanitized value
    next();
  };
};

module.exports = { validate };

const { ValidationError } = require('../utils/AppError');

/**
 * Generic Request Validation Middleware using Zod.
 *
 * @param {object} schemas - Object containing optional body, query, or params Zod schemas.
 * @example
 * router.post('/login', validate({ body: loginSchema }), authController.login);
 */
const validate = (schemas) => {
  return (req, res, next) => {
    const validationErrors = [];

    // Validate request body
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          validationErrors.push({
            location: 'body',
            field: issue.path.join('.'),
            message: issue.message,
          });
        });
      } else {
        req.body = result.data;
      }
    }

    // Validate request query parameters
    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          validationErrors.push({
            location: 'query',
            field: issue.path.join('.'),
            message: issue.message,
          });
        });
      } else {
        req.query = result.data;
      }
    }

    // Validate route parameters
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          validationErrors.push({
            location: 'params',
            field: issue.path.join('.'),
            message: issue.message,
          });
        });
      } else {
        req.params = result.data;
      }
    }

    if (validationErrors.length > 0) {
      return next(new ValidationError('Request validation failed', validationErrors));
    }

    next();
  };
};

module.exports = validate;

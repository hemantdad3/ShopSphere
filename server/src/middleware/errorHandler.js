const { AppError } = require('../utils/AppError');

/**
 * Convert specific Mongoose CastError to standard AppError
 */
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400, 'INVALID_ID');
};

/**
 * Convert Mongoose duplicate key error (code 11000) to standard AppError
 */
const handleDuplicateFieldsDB = (err) => {
  const fields = Object.keys(err.keyValue || {});
  const fieldList = fields.length > 0 ? fields.join(', ') : 'field';
  const message = `Duplicate value entered for ${fieldList}. Please use another value.`;
  return new AppError(message, 409, 'DUPLICATE_RESOURCE');
};

/**
 * Convert Mongoose Schema ValidationError to standard AppError
 */
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => ({
    field: el.path,
    message: el.message,
  }));
  return new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors);
};

/**
 * Development error payload (includes stack trace)
 */
const sendErrorDev = (err, res) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message,
    code: err.code || 'SERVER_ERROR',
    errors: err.errors || null,
    stack: err.stack,
  });
};

/**
 * Production error payload (sanitized for client)
 */
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code || 'OPERATIONAL_ERROR',
      ...(err.errors && { errors: err.errors }),
    });
  } else {
    // Programming or unknown error: don't leak details to client
    console.error('[ERROR 💥] Unexpected Server Exception:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong on our end. Please try again later.',
      code: 'SERVER_ERROR',
    });
  }
};

/**
 * Global Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;

  let error = { ...err, message: err.message, stack: err.stack, name: err.name };

  // Handle Mongoose specific errors
  if (error.name === 'CastError') error = handleCastErrorDB(error);
  if (error.code === 11000) error = handleDuplicateFieldsDB(error);
  if (error.name === 'ValidationError') error = handleValidationErrorDB(error);

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

module.exports = errorHandler;

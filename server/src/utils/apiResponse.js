/**
 * Standard API Response Formatters
 */

/**
 * Send a standardized success JSON response.
 *
 * @param {object} res - Express response object
 * @param {any} data - Payload data
 * @param {string} message - Human-readable success message
 * @param {number} statusCode - HTTP status code (default 200)
 * @param {object} meta - Optional pagination or metadata
 */
const sendSuccess = (res, data = null, message = 'Success', statusCode = 200, meta = null) => {
  const response = {
    success: true,
    message,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send a standardized error JSON response.
 *
 * @param {object} res - Express response object
 * @param {string} message - Error description
 * @param {number} statusCode - HTTP status code (default 500)
 * @param {string} code - Machine-readable error code
 * @param {array} errors - Detailed field validation errors
 */
const sendError = (
  res,
  message = 'An unexpected error occurred',
  statusCode = 500,
  code = 'SERVER_ERROR',
  errors = null
) => {
  const response = {
    success: false,
    message,
    code,
  };

  if (errors && errors.length > 0) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

module.exports = {
  sendSuccess,
  sendError,
};

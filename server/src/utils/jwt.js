const jwt = require('jsonwebtoken');
const { sendSuccess } = require('./apiResponse');

/**
 * Sign JWT token with payload
 */
const signToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * Send JWT in an HTTP-only secure cookie and return standardized success response.
 *
 * @param {object} user - Mongoose user document
 * @param {number} statusCode - HTTP status code
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {string} message - Success message
 */
const sendTokenCookie = (user, statusCode, req, res, message = 'Success') => {
  const token = signToken(user._id, user.role);

  // Parse expiration days from environment or default to 7 days
  const cookieExpiresDays = parseInt(process.env.JWT_COOKIE_EXPIRES_IN, 10) || 7;

  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    expires: new Date(Date.now() + cookieExpiresDays * 24 * 60 * 60 * 1000),
    httpOnly: true, // Invariant: immune to XSS token theft
    secure: isProduction || req.secure || req.headers['x-forwarded-proto'] === 'https',
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    ...(isProduction && { partitioned: true }), // CHIPS: Partitioned cookies for cross-site iframe/subdomain compatibility
  };

  res.cookie('jwt', token, cookieOptions);

  // Sanitize user object
  const userJson = user.toJSON ? user.toJSON() : { ...user };
  delete userJson.passwordHash;

  return sendSuccess(
    res,
    {
      user: userJson,
      // Provide token in response payload only during development for curl/Postman testing
      ...(process.env.NODE_ENV === 'development' && { token }),
    },
    message,
    statusCode
  );
};

/**
 * Clear authentication cookie
 */
const clearTokenCookie = (res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 5 * 1000), // Expire in 5 seconds
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    path: '/',
    ...(isProduction && { partitioned: true }),
  });
};

module.exports = {
  signToken,
  sendTokenCookie,
  clearTokenCookie,
};

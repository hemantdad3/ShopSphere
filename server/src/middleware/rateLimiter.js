const rateLimit = require('express-rate-limit');

/**
 * Standardized 429 Too Many Requests response handler
 */
const rateLimitHandler = (message, code = 'TOO_MANY_REQUESTS') => (req, res) => {
  res.status(429).json({
    success: false,
    status: 'fail',
    code,
    message,
  });
};

/**
 * General API Limiter:
 * 300 requests per 15-minute sliding window per IP
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => {
    if (req.headers['x-test-rate-limit'] === 'true') return 3;
    return 300;
  },
  standardHeaders: true, // Return RateLimit headers
  legacyHeaders: false,
  handler: rateLimitHandler(
    'Too many requests from this IP, please try again after 15 minutes',
    'TOO_MANY_REQUESTS'
  ),
  skip: (req) => {
    // Let authLimiter handle auth routes to avoid double counting
    if (req.originalUrl && req.originalUrl.includes('/auth')) return true;
    // In non-production environments, skip unless test explicitly activates rate limit check
    if (process.env.NODE_ENV !== 'production') {
      return req.headers['x-test-rate-limit'] !== 'true';
    }
    return false;
  },
});

/**
 * Strict Auth Limiter:
 * 10 requests per 15-minute sliding window per IP for login/register/forgot-password
 * Defends against brute-force credential stuffing and password guessing.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => {
    if (req.headers['x-test-rate-limit'] === 'true') return 3;
    return 10;
  },
  keyGenerator: (req) => {
    // Support test-isolated client IDs for deterministic test execution
    if (req.headers['x-test-client-id']) {
      return req.headers['x-test-client-id'];
    }
    return req.ip || '127.0.0.1';
  },
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler(
    'Too many authentication attempts from this IP, please try again after 15 minutes',
    'AUTH_RATE_LIMIT_EXCEEDED'
  ),
  skip: (req) => {
    if (process.env.NODE_ENV !== 'production') {
      return req.headers['x-test-rate-limit'] !== 'true';
    }
    return false;
  },
});

/**
 * Strict Checkout Limiter:
 * 20 requests per 15-minute sliding window per IP for checkout creation
 * Defends against inventory hoarding bots and denial-of-inventory attacks.
 */
const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => {
    if (req.headers['x-test-rate-limit'] === 'true') return 3;
    return 20;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler(
    'Too many checkout attempts from this IP, please try again after 15 minutes',
    'CHECKOUT_RATE_LIMIT_EXCEEDED'
  ),
  skip: (req) => {
    if (process.env.NODE_ENV !== 'production') {
      return req.headers['x-test-rate-limit'] !== 'true';
    }
    return false;
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  checkoutLimiter,
};

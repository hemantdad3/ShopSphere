const helmet = require('helmet');

/**
 * Helmet Security Headers Configuration
 *
 * Configures Content-Security-Policy (with Razorpay & ImageKit whitelists),
 * removes X-Powered-By, enables HSTS, nosniff, and frameguard.
 */
const configureHelmet = () => {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://checkout.razorpay.com'],
        frameSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
        connectSrc: ["'self'", 'https://api.razorpay.com', 'https://lumberjack.razorpay.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://ik.imagekit.io', 'https://images.unsplash.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    xContentTypeOptions: true,
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });
};

/**
 * Recursively strips keys containing MongoDB query operators (starting with '$') or '.'
 * Defends against NoSQL operator injection payloads (e.g. `{ "email": { "$gt": "" } }`).
 *
 * @param {object} obj - Object to recursively inspect and clean
 * @returns {object} Cleaned object
 */
const sanitizeNoSQL = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = sanitizeNoSQL(obj[i]);
    }
    return obj;
  }

  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeNoSQL(obj[key]);
    }
  }
  return obj;
};

/**
 * Express middleware for NoSQL injection defense
 */
const noSqlSanitizer = (req, res, next) => {
  if (req.body) sanitizeNoSQL(req.body);
  if (req.query) sanitizeNoSQL(req.query);
  if (req.params) sanitizeNoSQL(req.params);
  next();
};

/**
 * Recursively strips script tags and sanitizes malicious HTML from user inputs.
 * Leaves password and security tokens intact.
 */
const sanitizeXSS = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = sanitizeXSS(obj[i]);
    }
    return obj;
  }

  for (const key of Object.keys(obj)) {
    // Preserve authentication credentials and tokens
    if (['password', 'passwordHash', 'token', 'refreshToken'].includes(key)) {
      continue;
    }

    if (typeof obj[key] === 'string') {
      // Strip executable script tags
      obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').trim();
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeXSS(obj[key]);
    }
  }
  return obj;
};

/**
 * Express middleware for XSS sanitization
 */
const xssSanitizer = (req, res, next) => {
  if (req.body) sanitizeXSS(req.body);
  if (req.query) sanitizeXSS(req.query);
  next();
};

module.exports = {
  configureHelmet,
  noSqlSanitizer,
  xssSanitizer,
  sanitizeNoSQL,
  sanitizeXSS,
};

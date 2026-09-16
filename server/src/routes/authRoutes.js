const express = require('express');
const authController = require('../controllers/authController');
const { protect, restrictTo } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../validators/authValidator');
const { sendSuccess } = require('../utils/apiResponse');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Public Authentication Routes (Guarded by strict authLimiter)
router.post('/register', authLimiter, validate({ body: registerSchema }), authController.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
router.post('/logout', authController.logout);
router.post('/forgot-password', authLimiter, validate({ body: forgotPasswordSchema }), authController.forgotPassword);
router.post('/reset-password/:token', validate({ body: resetPasswordSchema }), authController.resetPassword);

// Protected Routes (Requires valid JWT)
router.get('/me', protect, authController.getMe);

// Verification Route: Admin-Only RBAC test endpoint
router.get('/admin-test', protect, restrictTo('ADMIN'), (req, res) => {
  return sendSuccess(res, { admin: req.user.name }, 'Admin access confirmed.');
});

module.exports = router;

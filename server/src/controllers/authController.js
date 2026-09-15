const crypto = require('crypto');
const User = require('../models/User');
const {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');
const { sendTokenCookie, clearTokenCookie } = require('../utils/jwt');
const { sendPasswordResetEmail } = require('../utils/email');

/**
 * Register a new customer account
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new ConflictError('An account with this email address already exists.'));
    }

    // Security invariant: Default public registration to CUSTOMER role only
    const newUser = await User.create({
      name,
      email,
      passwordHash: password,
      role: 'CUSTOMER',
    });

    return sendTokenCookie(newUser, 201, req, res, 'Registration successful. Welcome to ShopSphere!');
  } catch (err) {
    next(err);
  }
};

/**
 * Authenticate customer or admin and issue HTTP-only JWT cookie
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Retrieve user and explicitly select passwordHash
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await user.comparePassword(password))) {
      return next(new UnauthorizedError('Incorrect email or password.'));
    }

    return sendTokenCookie(user, 200, req, res, 'Login successful.');
  } catch (err) {
    next(err);
  }
};

/**
 * Clear authentication cookie
 * POST /api/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    clearTokenCookie(res);
    return sendSuccess(res, null, 'Logged out successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * Get authenticated user session profile
 * GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    return sendSuccess(res, { user: req.user }, 'User profile retrieved successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * Initiate password reset flow by sending token via email
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return next(new NotFoundError('No user found with that email address.'));
    }

    // Generate random reset token & set 15-minute expiration
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Construct client reset URL
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

    try {
      await sendPasswordResetEmail(user.email, resetUrl);

      return sendSuccess(
        res,
        {
          ...(process.env.NODE_ENV === 'development' && { resetToken }),
        },
        'Password reset link has been dispatched to your email address (valid for 15 minutes).'
      );
    } catch (emailErr) {
      // Revert token fields if email dispatch fails
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      return next(new BadRequestError('There was an error sending the reset email. Please try again later.'));
    }
  } catch (err) {
    next(err);
  }
};

/**
 * Reset password using verification token
 * POST /api/auth/reset-password/:token
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Hash token to compare with database representation
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return next(new BadRequestError('Password reset token is invalid or has expired.'));
    }

    // Update password and clear reset tokens
    user.passwordHash = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return sendTokenCookie(user, 200, req, res, 'Password reset successful. You are now logged in.');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
};

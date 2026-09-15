const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { UnauthorizedError, ForbiddenError } = require('../utils/AppError');

/**
 * Authentication Middleware: Verifies JWT from HTTP-only cookie or Authorization header.
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Extract token from HTTP-only cookie (primary transport) or Bearer header (fallback)
    if (req.cookies && req.cookies.jwt && req.cookies.jwt !== 'loggedout') {
      token = req.cookies.jwt;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(
        new UnauthorizedError('You are not logged in. Please authenticate to gain access.')
      );
    }

    // 2. Verify token validity and signature
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'JsonWebTokenError') {
        return next(new UnauthorizedError('Invalid authentication token. Please log in again.'));
      }
      if (err.name === 'TokenExpiredError') {
        return next(
          new UnauthorizedError('Your session has expired. Please log in again to continue.')
        );
      }
      return next(new UnauthorizedError('Authentication failed.'));
    }

    // 3. Check if user still exists in the database
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next(
        new UnauthorizedError('The user belonging to this authentication token no longer exists.')
      );
    }

    // 4. Invariant: Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(
        new UnauthorizedError('Password was recently changed. Please log in again with your new credentials.')
      );
    }

    // 5. Grant access to protected route and attach user to request object
    req.user = currentUser;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Authorization Middleware: Restricts route access to specific roles.
 *
 * @param  {...string} roles - Permitted roles (e.g. 'ADMIN')
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new ForbiddenError('Access forbidden: You do not have permission to perform this action.')
      );
    }
    next();
  };
};

module.exports = {
  protect,
  restrictTo,
};

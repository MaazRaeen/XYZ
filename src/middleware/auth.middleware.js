const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/appError');

/**
 * Route protection middleware to authenticate user via JWT Bearer Token
 */
const protect = async (req, res, next) => {
  try {
    let token;
    
    // Extract access token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('You are not logged in. Please authenticate to gain access.', 401));
    }

    // Verify the JWT token signature
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('Your session token has expired. Please rotate your tokens.', 401));
      }
      return next(new AppError('Invalid token signature. Please log in again.', 401));
    }

    // Ensure the token owner still exists in database
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    // Assign authenticated user to the request context
    req.user = currentUser;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role-Based Access Control (RBAC) authorization filter
 * @param {...string} roles - Allowed user roles
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to execute this operations.', 403));
    }
    next();
  };
};

module.exports = {
  protect,
  restrictTo
};

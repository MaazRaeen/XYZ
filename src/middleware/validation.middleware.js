const { validationResult } = require('express-validator');
const AppError = require('../utils/appError');

/**
 * Middleware to intercept express-validator results and format as operational AppError 400s
 */
const validateFields = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => `${err.path || err.param}: ${err.msg}`).join(', ');
    return next(new AppError(`Validation failed: ${errorMessages}`, 400));
  }
  next();
};

module.exports = validateFields;

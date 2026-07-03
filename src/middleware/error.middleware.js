const AppError = require('../utils/appError');

/**
 * Global Express Error Handling Middleware
 */
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
      stack: err.stack,
      error: err
    });
  } else {
    // Production Mode
    if (err.isOperational) {
      // Operational, trusted error: send message to client
      res.status(err.statusCode).json({
        success: false,
        status: err.status,
        message: err.message
      });
    } else {
      // Programming or other unknown error: don't leak details
      console.error('ERROR 💥:', err);
      res.status(500).json({
        success: false,
        status: 'error',
        message: 'Something went wrong on the server!'
      });
    }
  }
};

module.exports = globalErrorHandler;

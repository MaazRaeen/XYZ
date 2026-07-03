const mongoose = require('mongoose');

/**
 * Check the connection status of Express Server and MongoDB
 */
const getHealthStatus = async (req, res, next) => {
  try {
    const dbState = mongoose.connection.readyState;
    const dbStatusMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    res.status(200).json({
      success: true,
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: `${process.uptime().toFixed(2)}s`,
      database: dbStatusMap[dbState] || 'unknown'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHealthStatus
};

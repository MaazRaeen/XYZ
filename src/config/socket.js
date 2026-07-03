const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Device = require('../models/Device');

let io;

/**
 * Initialize Socket.IO server on top of HTTP server
 * @param {object} server - HTTP Server instance
 */
const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
      if (!token) {
        return next(new Error('Authentication failed: Missing JWT access token'));
      }

      // Handle Bearer header scheme prefix if present
      const jwtToken = token.startsWith('Bearer ') ? token.split(' ')[1] : token;

      // Verify signature
      const decoded = jwt.verify(jwtToken, process.env.JWT_ACCESS_SECRET);
      
      // Ensure user profile exists
      const user = await User.findById(decoded.id);
      if (!user) {
        return next(new Error('Authentication failed: Associated profile not found'));
      }

      // Cache user object in socket context
      socket.user = user;
      next();
    } catch (err) {
      return next(new Error('Authentication failed: Invalid or expired session token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected via WebSockets: ${socket.id} (User: ${socket.user.email})`);

    // Handle requests to subscribe/join a device telemetry stream
    socket.on('join_device', async ({ deviceId }) => {
      try {
        if (!deviceId) {
          return socket.emit('error', { message: 'Hardware deviceId parameter is required' });
        }

        // Verify device records exist
        const device = await Device.findOne({ deviceId });
        if (!device) {
          return socket.emit('error', { message: 'Device registry not found matching this identifier' });
        }

        // Authorize user ownership
        if (
          socket.user.role !== 'admin' &&
          socket.user.role !== 'tech' &&
          device.owner.toString() !== socket.user._id.toString()
        ) {
          return socket.emit('error', { message: 'Access denied: You do not own this device' });
        }

        // Join Socket.io room named after deviceId (e.g. BMS-UNIT-1001)
        socket.join(deviceId);
        console.log(`➡️ Socket client ${socket.id} subscribed to device room: ${deviceId}`);
        socket.emit('joined', { success: true, room: deviceId });
      } catch (err) {
        socket.emit('error', { message: 'An internal error occurred during subscription' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected from WebSockets: ${socket.id}`);
    });
  });

  return io;
};

/**
 * Retrieve active socket engine instance
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO is not initialized yet!');
  }
  return io;
};

/**
 * Broadcast telemetry data to all room subscribers
 * @param {string} deviceId - Hardware device identifier (room key)
 * @param {object} telemetryData - Recorded log payload to broadcast
 */
const broadcastTelemetry = (deviceId, telemetryData) => {
  if (!io) {
    throw new Error('Socket.IO is not initialized yet!');
  }
  
  io.to(deviceId).emit('telemetry_update', {
    success: true,
    deviceId,
    timestamp: new Date().toISOString(),
    data: telemetryData
  });
  console.log(`📡 Broadcasted live telemetry packet to room: ${deviceId}`);
};

module.exports = {
  initSocket,
  getIO,
  broadcastTelemetry
};

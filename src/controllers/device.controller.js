const mongoose = require('mongoose');
const Device = require('../models/Device');
const BatteryPack = require('../models/BatteryPack');
const BatteryCell = require('../models/BatteryCell');
const TelemetryLog = require('../models/TelemetryLog');
const FaultLog = require('../models/FaultLog');
const AppError = require('../utils/appError');
const { broadcastTelemetry } = require('../config/socket');
const { sendPushNotification } = require('../services/notification');

/**
 * Helper to assert device existence and verify user ownership
 */
const getVerifiedDevice = async (id, userId, userRole, next) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid Device database identifier format.', 400));
  }

  const device = await Device.findById(id);
  if (!device) {
    return next(new AppError('No device found matching this identifier.', 404));
  }

  // Enforce ownership check unless user is admin or technician
  if (userRole !== 'admin' && userRole !== 'tech' && (!device.owner || device.owner.toString() !== userId.toString())) {
    return next(new AppError('You do not have permission to access this device.', 403));
  }

  return device;
};

/**
 * Register a new device
 * POST /api/devices
 */
const registerDevice = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { deviceId, name, connectionType } = req.body;

    // Check if deviceId hardware key is already registered
    const existingDevice = await Device.findOne({ deviceId }).session(session);
    if (existingDevice) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Hardware Device ID is already registered.', 409));
    }

    // 1. Create Device
    const newDevice = new Device({
      deviceId,
      name,
      connectionType,
      owner: req.user._id,
      status: 'offline'
    });

    // 2. Create companions BatteryPack
    const defaultPack = new BatteryPack({
      packId: `PACK-${deviceId}`,
      deviceId: newDevice._id,
      capacityAh: 100,
      nominalVoltage: 51.2,
      cellCount: 16,
      stateOfHealth: 100
    });

    await defaultPack.save({ session });

    newDevice.batteryPackId = defaultPack._id;
    await newDevice.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      data: {
        device: newDevice,
        batteryPack: defaultPack
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * List user's devices
 * GET /api/devices
 */
const getDevices = async (req, res, next) => {
  try {
    const query = {};
    
    // Admins and techs can view all devices; standard users view only owned devices
    if (req.user.role !== 'admin' && req.user.role !== 'tech') {
      query.owner = req.user._id;
    }

    const devices = await Device.find(query).populate('batteryPackId');

    res.status(200).json({
      success: true,
      count: devices.length,
      data: devices
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch detailed device info
 * GET /api/devices/:id
 */
const getDevice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const device = await getVerifiedDevice(id, req.user._id, req.user.role, next);
    if (!device) return;

    // Retrieve pack details
    const pack = await BatteryPack.findById(device.batteryPackId);

    res.status(200).json({
      success: true,
      data: {
        device,
        batteryPack: pack
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update device configurations
 * PUT /api/devices/:id
 */
const updateDevice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, connectionType, status } = req.body;

    const device = await getVerifiedDevice(id, req.user._id, req.user.role, next);
    if (!device) return;

    if (name) device.name = name;
    if (connectionType) device.connectionType = connectionType;
    if (status) device.status = status;
    device.lastSeen = Date.now();

    await device.save();

    res.status(200).json({
      success: true,
      message: 'Device updated successfully.',
      data: device
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete device entry and associated packs
 * DELETE /api/devices/:id
 */
const deleteDevice = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const device = await getVerifiedDevice(id, req.user._id, req.user.role, next);
    if (!device) {
      await session.abortTransaction();
      session.endSession();
      return;
    }

    // Remove associated battery pack
    if (device.batteryPackId) {
      await BatteryPack.findByIdAndDelete(device.batteryPackId).session(session);
      // Remove associated cells
      await BatteryCell.deleteMany({ packId: device.batteryPackId }).session(session);
    }

    // Delete Device
    await Device.findByIdAndDelete(id).session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Device and associated battery pack components deleted.'
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Save telemetry logs
 * POST /api/devices/:id/telemetry
 */
const saveTelemetry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { voltage, current, temperature, stateOfCharge, timestamp } = req.body;

    const device = await getVerifiedDevice(id, req.user._id, req.user.role, next);
    if (!device) return;

    // Calculate power (W) = Voltage (V) * Current (A)
    const power = voltage * current;

    // Create TelemetryLog entry
    const log = await TelemetryLog.create({
      timestamp: timestamp || Date.now(),
      deviceId: device._id,
      voltage,
      current,
      power,
      temperature,
      stateOfCharge
    });

    // Update lastSeen of the gateway and toggle status to online
    device.lastSeen = Date.now();
    device.status = 'online';
    await device.save();

    // Broadcast telemetry via WebSockets in real-time
    broadcastTelemetry(device.deviceId, log);

    res.status(201).json({
      success: true,
      message: 'Telemetry log recorded.',
      data: log
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve telemetry history
 * GET /api/devices/:id/telemetry
 */
const getTelemetryHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, page = 1, limit = 100 } = req.query;

    const device = await getVerifiedDevice(id, req.user._id, req.user.role, next);
    if (!device) return;

    // Construct timestamp range filter
    const query = { deviceId: device._id };
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch logs (newest logs first)
    const logs = await TelemetryLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await TelemetryLog.countDocuments(query);

    res.status(200).json({
      success: true,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      },
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch latest cell telemetry status
 * GET /api/devices/:id/cells
 */
const getLatestCellData = async (req, res, next) => {
  try {
    const { id } = req.params;
    const device = await getVerifiedDevice(id, req.user._id, req.user.role, next);
    if (!device) return;

    if (!device.batteryPackId) {
      return next(new AppError('No battery pack is mapped to this device.', 404));
    }

    // Retrieve cells linked to this pack, sorted by cell number index
    const cells = await BatteryCell.find({ packId: device.batteryPackId })
      .sort({ cellNumber: 1 });

    res.status(200).json({
      success: true,
      count: cells.length,
      data: cells
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Log a hardware fault event
 * POST /api/devices/:id/faults
 */
const logFault = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { faultType, severity, message, timestamp } = req.body;

    const device = await getVerifiedDevice(id, req.user._id, req.user.role, next);
    if (!device) return;

    const fault = await FaultLog.create({
      deviceId: device._id,
      faultType,
      severity,
      message,
      timestamp: timestamp || Date.now(),
      resolved: false
    });

    // Trigger push notification to owner on high or critical faults
    if (severity && ['high', 'critical'].includes(severity.toLowerCase())) {
      if (device.owner) {
        sendPushNotification(
          device.owner,
          `BMS Alert: ${device.name}`,
          `Critical safety fault logged: ${message} (${severity.toUpperCase()})`,
          {
            deviceId: device.deviceId,
            faultType,
            severity,
            faultId: fault._id.toString()
          }
        );
      }
    }

    res.status(201).json({
      success: true,
      message: 'Safety Fault recorded successfully.',
      data: fault
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List device fault logs
 * GET /api/devices/:id/faults
 */
const getFaults = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resolved, page = 1, limit = 50 } = req.query;

    const device = await getVerifiedDevice(id, req.user._id, req.user.role, next);
    if (!device) return;

    const query = { deviceId: device._id };
    if (resolved !== undefined) {
      query.resolved = resolved === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const faults = await FaultLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await FaultLog.countDocuments(query);

    res.status(200).json({
      success: true,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      },
      data: faults
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerDevice,
  getDevices,
  getDevice,
  updateDevice,
  deleteDevice,
  saveTelemetry,
  getTelemetryHistory,
  getLatestCellData,
  logFault,
  getFaults
};

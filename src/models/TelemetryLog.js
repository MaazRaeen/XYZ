const mongoose = require('mongoose');

const telemetryLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true
  },
  voltage: {
    type: Number,
    required: [true, 'Pack voltage is required']
  },
  current: {
    type: Number,
    required: [true, 'Pack current is required']
  },
  power: {
    type: Number,
    required: [true, 'Calculated power is required']
  },
  temperature: {
    type: Number,
    required: [true, 'Temperature measurement is required']
  },
  stateOfCharge: {
    type: Number,
    required: [true, 'State of Charge is required'],
    min: [0, 'SoC cannot be below 0%'],
    max: [100, 'SoC cannot exceed 100%']
  }
}, {
  // Configures native MongoDB Time-Series collection characteristics
  timeseries: {
    timeField: 'timestamp',
    metaField: 'deviceId',
    granularity: 'seconds'
  }
});

module.exports = mongoose.model('TelemetryLog', telemetryLogSchema);

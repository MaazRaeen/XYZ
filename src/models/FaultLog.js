const mongoose = require('mongoose');

const faultLogSchema = new mongoose.Schema({
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true
  },
  faultType: {
    type: String,
    enum: ['COV', 'CUV', 'OCC', 'OCD', 'OTP', 'UTP', 'SCP'],
    required: true
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'high', 'critical'],
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  resolved: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: true
});

// Indexes for fast lookup of active faults and historical device sweeps
faultLogSchema.index({ deviceId: 1, timestamp: -1 });
faultLogSchema.index({ resolved: 1 });

module.exports = mongoose.model('FaultLog', faultLogSchema);

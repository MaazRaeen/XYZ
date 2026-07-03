const mongoose = require('mongoose');

const chargingSessionSchema = new mongoose.Schema({
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: {
    type: Date,
    default: null
  },
  startSoC: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  endSoC: {
    type: Number,
    min: 0,
    max: 100,
    default: null
  },
  energyAddedWh: {
    type: Number,
    min: 0,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'interrupted', 'error'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Index to pull session list chronologically for any single device
chargingSessionSchema.index({ deviceId: 1, startTime: -1 });

module.exports = mongoose.model('ChargingSession', chargingSessionSchema);

const mongoose = require('mongoose');

const batteryPackSchema = new mongoose.Schema({
  packId: {
    type: String,
    required: [true, 'Battery Pack identifier is required'],
    unique: true,
    trim: true,
    index: true
  },
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    default: null
  },
  capacityAh: {
    type: Number,
    required: [true, 'Capacity in Ah is required'],
    min: [0, 'Capacity cannot be negative']
  },
  nominalVoltage: {
    type: Number,
    required: [true, 'Nominal voltage is required'],
    min: [0, 'Nominal voltage cannot be negative']
  },
  cellCount: {
    type: Number,
    required: [true, 'Cell count is required'],
    min: [1, 'Must have at least one cell']
  },
  cycleCount: {
    type: Number,
    default: 0,
    min: [0, 'Cycle count cannot be negative']
  },
  stateOfHealth: {
    type: Number,
    required: [true, 'State of Health (SoH) is required'],
    min: [0, 'SoH cannot be below 0%'],
    max: [100, 'SoH cannot exceed 100%'],
    default: 100
  }
}, {
  timestamps: true
});

// Indexes
batteryPackSchema.index({ deviceId: 1 });

module.exports = mongoose.model('BatteryPack', batteryPackSchema);

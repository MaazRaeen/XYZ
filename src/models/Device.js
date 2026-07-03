const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: [true, 'Device identifier is required'],
    unique: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Device name is required'],
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  batteryPackId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BatteryPack',
    default: null
  },
  connectionType: {
    type: String,
    enum: ['BLE', 'WiFi'],
    required: [true, 'Connection type is required']
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['online', 'offline'],
    default: 'offline'
  }
}, {
  timestamps: true
});

// Compound/Secondary Indexes
deviceSchema.index({ owner: 1 });
deviceSchema.index({ batteryPackId: 1 });

module.exports = mongoose.model('Device', deviceSchema);

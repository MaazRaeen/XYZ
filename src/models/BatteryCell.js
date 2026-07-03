const mongoose = require('mongoose');

const batteryCellSchema = new mongoose.Schema({
  cellId: {
    type: String,
    required: [true, 'Cell identifier is required'],
    unique: true,
    trim: true,
    index: true
  },
  packId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BatteryPack',
    required: [true, 'Battery Pack reference is required']
  },
  cellNumber: {
    type: Number,
    required: [true, 'Cell position index is required'],
    min: [0, 'Cell position index cannot be negative']
  },
  voltage: {
    type: Number,
    required: [true, 'Cell voltage is required']
  },
  resistance: {
    type: Number,
    required: [true, 'Internal resistance is required']
  },
  temperature: {
    type: Number,
    required: [true, 'Cell temperature is required']
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: true
});

// Composite index to speed up lookup of cell statistics inside a pack
batteryCellSchema.index({ packId: 1, cellNumber: 1 });
batteryCellSchema.index({ timestamp: -1 });

module.exports = mongoose.model('BatteryCell', batteryCellSchema);

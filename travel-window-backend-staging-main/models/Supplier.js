const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  bookingCharge: {
    type: Number,
    default: 0
  },
  updationCharge: {
    type: Number,
    default: 0
  },
  cancellationCharge: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Supplier', supplierSchema);

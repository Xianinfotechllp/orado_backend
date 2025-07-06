const mongoose = require('mongoose');
const policyRuleSchema = require('./PolicyRule');

const cancellationPolicySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  createdBy: {
    type: String, // 'Admin' or 'Restaurant'
    required: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  pendingOrder: {
    enabled: { type: Boolean, default: false },
    fixedCharge: { type: Number, min: 0 },
    percentCharge: { type: Number, min: 0, max: 100 }
  },
  acceptedOrder: {
    enabled: { type: Boolean, default: false },
    rules: [policyRuleSchema]
  },
  dispatchedOrder: {
    enabled: { type: Boolean, default: false },
    fixedCharge: { type: Number, min: 0 },
    percentCharge: { type: Number, min: 0, max: 100 }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('CancellationPolicy', cancellationPolicySchema);

const mongoose = require('mongoose');

const incentivePlanSchema = new mongoose.Schema({
  planType: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    required: true,
  },
  targetType: {
    type: String,
    enum: ['delivery_fee'], // Extendable later
    default: 'delivery_fee',
  },
  condition: {
    type: String,
    enum: ['>=', '>', '<', '<=', '=='],
    default: '>='
  },
  thresholdAmount: {
    type: Number, // e.g. ₹300, ₹4000
    required: true,
  },
  incentiveAmount: {
    type: Number, // e.g. ₹100, ₹1500
    required: true,
  },
  effectiveFrom: {
    type: Date,
    required: true,
  },
  effectiveTo: {
    type: Date,
  },

  // 👇 Supports selected cities OR global application
  cities: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'City',
  }],
  applyToAllCities: {
    type: Boolean,
    default: false,
  },

  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  createdBy: {
    type: String, // admin email or ID
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('IncentivePlan', incentivePlanSchema);

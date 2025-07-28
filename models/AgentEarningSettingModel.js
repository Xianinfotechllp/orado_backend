const mongoose = require('mongoose');

const AgentEarningSettingSchema = new mongoose.Schema({
  mode: {
    type: String,
    enum: ['global', 'merchant', 'city'], // supports global, merchant, or city-level config
    default: 'global',
  },

  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: function () {
      return this.mode === 'merchant';
    },
  },

  cityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'City',
    required: function () {
      return this.mode === 'city';
    },
  },

  baseFee: {
    type: Number,
    required: true,
    default: 20,
  },

  baseKm: {
    type: Number,
    required: true,
    default: 2,
  },

  perKmFeeBeyondBase: {
    type: Number,
    required: true,
    default: 10,
  },

  peakHourBonus: {
    type: Number,
    default: 20,
  },

  rainBonus: {
    type: Number,
    default: 15,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('AgentEarningSetting', AgentEarningSettingSchema);

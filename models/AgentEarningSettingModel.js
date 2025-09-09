const mongoose = require('mongoose');

const AgentEarningSettingSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: ['global', 'merchant', 'city'], // supports global, merchant, or city-level config
      default: 'global',
    },

    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
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
      default: 20,
    },

    baseKm: {
      type: Number,
      default: 2,
    },

    perKmFeeBeyondBase: {
      type: Number,
      default: 10,
    },

    // ✅ Flexible bonuses object (scalable for future)
    bonuses: {
      peakHour: { type: Number, default: 20 },
      rain: { type: Number, default: 15 },
      zone: { type: Number, default: 0 },
    },

    // ✅ Helpful flag to indicate explicit overrides
    isOverride: { type: Boolean, default: false },
  },
  { timestamps: true } // ✅ auto-creates createdAt & updatedAt
);

// ✅ Ensure only one unique config exists per mode+entity
AgentEarningSettingSchema.index(
  { mode: 1, cityId: 1, merchantId: 1 },
  { unique: true }
);

module.exports = mongoose.model('AgentEarningSetting', AgentEarningSettingSchema);

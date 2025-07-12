const mongoose = require("mongoose");

const loyaltySettingsSchema = new mongoose.Schema(
  {
    pointsPerAmount: {
      type: Number,
      required: true,
      default: 10, // points per ₹100 spent
    },
    minOrderAmountForEarning: {
      type: Number,
      required: true,
      default: 50, // minimum ₹ to qualify for points
    },
    maxEarningPoints: {
      type: Number,
      required: true,
      default: 500, // per order max cap
    },
    expiryDurationDays: {
      type: Number,
      required: true,
      default: 365, // points validity in days
    },
    redemptionCriteria: {
      type: Number,
      required: true,
      default: 100, // minimum points balance needed to redeem
    },
    valuePerPoint: {
      type: Number,
      required: true,
      default: 1, // ₹1 per point
    },
    minOrderAmountForRedemption: {
      type: Number,
      required: true,
      default: 100,
    },
    minPointsForRedemption: {
      type: Number,
      required: true,
      default: 50,
    },
    maxRedemptionPercent: {
      type: Number,
      required: true,
      default: 20,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("LoyaltySettings", loyaltySettingsSchema);

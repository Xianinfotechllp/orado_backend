const mongoose = require("mongoose");

const loyaltySettingSchema = new mongoose.Schema({
  earningCriteria: { type: Number, default: 100 }, // $100 = 5 points
  pointsPerAmount: { type: Number, default: 5 }, 
  minOrderAmountForEarning: { type: Number, default: 10 },
  maxEarningPoints: { type: Number, default: 20 },
  expiryDurationDays: { type: Number, default: 7 },
  redemptionCriteria: { type: Number, default: 50 }, // 2 points = $50
  pointsPerRedemptionAmount: { type: Number, default: 2 },
  minOrderAmountForRedemption: { type: Number, default: 5 },
  minPointsForRedemption: { type: Number, default: 6 },
  maxRedemptionPercent: { type: Number, default: 50 }
}, { timestamps: true });

module.exports = mongoose.model("LoyaltySetting", loyaltySettingSchema);

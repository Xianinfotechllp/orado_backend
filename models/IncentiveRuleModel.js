const mongoose = require("mongoose");

const incentiveRuleSchema = new mongoose.Schema({
  title: { type: String, required: true }, // e.g., "Daily 500 Earning Boost"
  type: {
    type: String,
    enum: ["daily", "weekly", "monthly", "peak", "slot", "login_bonus"],
    required: true
  },
  description: String,

  // Target Conditions (any combination can be set)
  condition: {
    basedOn: {
      type: String,
      enum: ["earning", "delivery_count", "attendance", "hybrid"], // support multiple rule types
      required: true
    },
    minEarning: Number,       // e.g., ₹500
    minOrders: Number,        // e.g., 10 orders
    workingDays: Number,      // e.g., 6 days in a week
  },

  // Reward section
  incentiveAmount: { type: Number, required: true }, // ₹150 bonus
  rewardType: {
    type: String,
    enum: ["fixed", "percentage"],
    default: "fixed"
  },

  // Validity Period
  startDate: Date,
  endDate: Date,

  // Visibility and control
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }
}, {
  timestamps: true
});

module.exports = mongoose.model("IncentiveRule", incentiveRuleSchema);

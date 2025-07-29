const mongoose = require("mongoose");

const agentIncentiveProgressSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true
  },
  incentiveRuleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'IncentiveRule',
    required: true
  },

  type: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'peak', 'slot', 'login_bonus'],
    required: true
  },

  targetValue: {
    type: Number,
    required: true
  }, // Target like ₹300 or 10 deliveries

  currentValue: {
    type: Number,
    default: 0
  }, // Progress like ₹250 or 8 deliveries

  percent: {
    type: Number,
    default: 0
  }, // Progress percentage

  completed: {
    type: Boolean,
    default: false
  },

  rewardEarned: {
    type: Boolean,
    default: false
  },

  rewardAmount: {
    type: Number,
    default: 0
  },

  // Time References
  date: Date,             // for daily incentive
  week: String,           // for weekly, format: "2025-W31"
  month: String,          // for monthly, format: "2025-07"

  // Optional: store raw earnings or orders
  totalEarnings: Number,
  totalOrders: Number,
  attendedDays: Number,

}, {
  timestamps: true
});

module.exports = mongoose.model("AgentIncentiveProgress", agentIncentiveProgressSchema);

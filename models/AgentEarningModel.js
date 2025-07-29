const mongoose = require("mongoose");

const earningComponentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["base_fee", "tip", "surge", "incentive", "penalty", "other"],
      required: true,
    },
    label: {
      type: String,
      default: null, // e.g. "Evening Surge", "Late Penalty"
    },
    amount: {
      type: Number,
      required: true,
    },
    remarks: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const agentEarningSchema = new mongoose.Schema(
  {
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    components: [earningComponentSchema],
    totalAmount: {
      type: Number,
      required: true,
    },
    earningDate: {
      type: Date,
      default: Date.now,
    },
    earningPeriod: {
      type: String,
      enum: ["daily", "weekly", "monthly", null],
      default: null,
    },
    incentiveRuleId: {
      // ✅ ADD THIS
      type: mongoose.Schema.Types.ObjectId,
      ref: "IncentiveRule",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("AgentEarning", agentEarningSchema);

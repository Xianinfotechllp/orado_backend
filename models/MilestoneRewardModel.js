const mongoose = require("mongoose");

const milestoneRewardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true }, // e.g. "100 On-time Deliveries"
    description: { type: String }, // e.g. "Complete 100 on-time deliveries and earn a smart watch"

    level: { type: Number, required: true }, // 1, 2, 3... for progressive rewards
    levelImageUrl: { type: String }, // 🏆 Badge/Level image (Bronze, Silver, Gold, etc.)

    conditions: {
      totalDeliveries: { type: Number, default: 0 }, // e.g. 200 total deliveries
      onTimeDeliveries: { type: Number, default: 0 }, // e.g. 100 on-time deliveries
      totalEarnings: { type: Number, default: 0 }, // e.g. ₹50,000 earned
    },

    reward: {
      name: { type: String, required: true }, // 🎁 e.g. "Smart Watch", "T-Shirt"
      description: { type: String }, // optional - details of reward
      imageUrl: { type: String }, // optional - reward image
    },

    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const MilestoneReward = mongoose.model("MilestoneReward", milestoneRewardSchema);

module.exports = MilestoneReward;

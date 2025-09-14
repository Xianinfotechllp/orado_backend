const mongoose = require("mongoose");

const agentMilestoneProgressSchema = new mongoose.Schema(
  {
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: "Agent", required: true },

    // Track milestones per level
    milestones: [
      {
        milestoneId: { type: mongoose.Schema.Types.ObjectId, ref: "MilestoneReward", required: true },
        level: { type: Number, required: true },

        // Progress for each condition
        conditionsProgress: {
          totalDeliveries: { type: Number, default: 0 },
          onTimeDeliveries: { type: Number, default: 0 },
          totalEarnings: { type: Number, default: 0 },
        },

        // Overall progress in percentage
        overallProgress: { type: Number, default: 0 }, // 0 - 100

        // Status of this milestone
        status: {
          type: String,
          enum: ["Locked", "In Progress", "Completed", "Reward Claimed"],
          default: "Locked", // Initially locked if previous level not completed
        },

        // Reward claim info
        rewardClaimed: {
          claimed: { type: Boolean, default: false },
          claimedAt: { type: Date },
        },

        // Optional history for audit
        history: [
          {
            updatedAt: { type: Date, default: Date.now },
            changes: { type: Object }, // Track incremental updates
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

const AgentMilestoneProgress = mongoose.model(
  "AgentMilestoneProgress",
  agentMilestoneProgressSchema
);

module.exports = AgentMilestoneProgress;

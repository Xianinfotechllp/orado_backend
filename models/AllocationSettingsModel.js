const mongoose = require("mongoose");

const allocationSettingsSchema = new mongoose.Schema(
  {
    isAutoAllocationEnabled: { type: Boolean, default: false },

    method: {
      type: String,
      enum: [
        "one_by_one",
        "send_to_all",
        "batch_wise",
        "round_robin",
        "nearest_available",
        "fifo",
        "pooling",
      ],
      default: "one_by_one",
    },

    // Round Robin Settings
    roundRobinSettings: {
      maxTasksAllowed: { type: Number, default: 20 },
      radiusKm: { type: Number, default: 10 },
      startAllocationBeforeTaskTimeMin: { type: Number, default: 0 },
      radiusIncrementKm: { type: Number, default: 2 },
      maximumRadiusKm: { type: Number, default: 10 },
      considerAgentRating: { type: Boolean, default: false },
    },

    // One by One Settings
    oneByOneSettings: {
      taskAllocationPriority: {
        type: [String],
        enum: ["captive", "freelancer"],
        default: [],
      },
      requestExpirySec: { type: Number, default: 30 },
      numberOfRetries: { type: Number, default: 0 },
      startAllocationBeforeTaskTimeMin: { type: Number, default: 0 },
      autoCancelSettings: {
        enabled: { type: Boolean, default: false },
        timeForAutoCancelOnFailSec: { type: Number, default: 0 },
      },
      considerAgentRating: { type: Boolean, default: false },
    },

    // Send to All Settings
    sendToAllSettings: {
      taskAllocationPriority: {
        type: [String],
        enum: ["captive", "freelancer"],
        default: ["captive", "freelancer"],
      },
      maxAgents: { type: Number, default: 500 },
      requestExpirySec: { type: Number, default: 30 },
      startAllocationBeforeTaskTimeMin: { type: Number, default: 0 },
      radiusKm: { type: Number, default: 5 },
      maximumRadiusKm: { type: Number, default: 20 },
      radiusIncrementKm: { type: Number, default: 2 },
    },

    // Batch Wise Settings
    batchWiseSettings: {
      batchSize: { type: Number, default: 5 },
      batchLimit: { type: Number, default: 5 },
    },

    // Nearest Available Settings
    nearestAvailableSettings: {
      taskAllocationPriority: {
        type: [String],
        enum: ["captive", "freelancer"],
        default: [],
      },
      calculateByRoadDistance: { type: Boolean, default: true },
      maximumRadiusKm: { type: Number, default: 10 },
      startAllocationBeforeTaskTimeMin: { type: Number, default: 0 },
      autoCancelSettings: {
        enabled: { type: Boolean, default: false },
        timeForAutoCancelOnFailSec: { type: Number, default: 0 },
      },
      considerAgentRating: { type: Boolean, default: false },
    },

    // FIFO Settings
    fifoSettings: {
      considerAgentRating: { type: Boolean, default: false },
      startAllocationBeforeTaskTimeMin: { type: Number, default: 0 },
      startRadiusKm: { type: Number, default: 3 },
      radiusIncrementKm: { type: Number, default: 2 },
      maximumRadiusKm: { type: Number, default: 10 },
      requestExpirySec: { type: Number, default: 25 },
    },

    // Pooling Settings
    poolingSettings: {
      poolSize: { type: Number, default: 10 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AllocationSettings", allocationSettingsSchema);

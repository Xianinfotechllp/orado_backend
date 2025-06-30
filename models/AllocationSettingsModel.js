// AllocationSettings Model

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
      taskAllocationPriority: {
        type: [String],
        enum: ["captive", "freelancer"],
        default: [],
      },

      maxTasksAllowed: { type: Number, default: 20 }, // max concurrent tasks per agent
      radiusKm: { type: Number, default: 10 }, // search radius for agents
      startAllocationBeforeTaskTimeMin: { type: Number, default: 0 }, // schedule before time

      samePickupRadiusMeters: { type: Number, default: 50 }, // to club orders for same pickup
      waitingTimeForPickupMin: { type: Number, default: 0 }, // wait time before pickup
      waitingTimeForDeliveryMin: { type: Number, default: 0 }, // wait time before delivery
      parkingTimeAtPickupMin: { type: Number, default: 0 }, // expected parking time

      shortestEtaIgnoreMin: { type: Number, default: 0 }, // ignore agents below this ETA
      shortestTimeSlaMin: { type: Number, default: 30 }, // max ETA allowed (SHORTEST TIME toggle)

      maxPoolTimeDifferenceMin: { type: Number, default: 30 }, // for pool orders
      maxPoolTaskCount: { type: Number, default: 999999 }, // limit on pooled tasks

      assignTaskToOffDutyAgents: { type: Boolean, default: false }, // include off-duty agents
      considerThisDistanceAsMaxDistance: { type: Boolean, default: true }, // enforce radiusKm strictly
      restartAllocationOnDecline: { type: Boolean, default: true }, // re-allocate if declined

      autoCancelSettings: {
        enabled: { type: Boolean, default: false },
        timeForAutoCancelOnFailSec: { type: Number, default: 0 },
      },

      considerAgentRating: { type: Boolean, default: false }, // prioritize by rating
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
        default: [],
      },
      maxAgents: { type: Number, default: 500 },
      requestExpirySec: { type: Number, default: 30 },
      startAllocationBeforeTaskTimeMin: { type: Number, default: 0 },
      autoCancelSettings: {
        enabled: { type: Boolean, default: false },
        timeForAutoCancelOnFailSec: { type: Number, default: 0 },
      },
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
      considerAgentRating: { type: Boolean, default: false }, // prioritize high rated agents
      startAllocationBeforeTaskTimeMin: { type: Number, default: 0 }, // for scheduled deliveries

      // Distance Settings
      startRadiusKm: { type: Number, default: 5 },
      radiusIncrementKm: { type: Number, default: 2 },
      maximumRadiusKm: { type: Number, default: 10 },

      // Time Settings
      batchProcessingTimeSec: { type: Number, default: 30 }, // when to create next batch
      requestTimeSec: { type: Number, default: 30 }, // how long agent can accept

      // Batch Settings
      maximumBatchSize: { type: Number, default: 5 }, // agents per batch
      maximumBatchLimit: { type: Number, default: 10 }, // batches formed in one attempt

      enableClubbing: { type: Boolean, default: false }, // allow task clubbing

      // Clubbing Settings (if enableClubbing = true)
      clubbingSettings: {
        deliveryDistanceKm: { type: Number, default: 5 }, // max delivery distance
        orderThresholdTimeSec: { type: Number, default: 120 }, // max order time difference in sec
        additionalTasksToBeClubbed: { type: Number, default: 2 }, // how many extra tasks can be clubbed
      },
    },
    // Pooling Settings
    poolingSettings: {
      poolSize: { type: Number, default: 10 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AllocationSettings", allocationSettingsSchema);

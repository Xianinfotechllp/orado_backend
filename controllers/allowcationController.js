const Joi = require("joi");
const AllocationSettings = require("../models/AllocationSettingsModel");

exports.updateAllocationSettings = async (req, res) => {
  console.log(req.body);

  // Method validation schema
  const methodSchema = Joi.object({
    method: Joi.string()
      .valid(
        "one_by_one",
        "send_to_all",
        "batch_wise",
        "round_robin",
        "nearest_available",
        "fifo",
        "pooling"
      )
      .required(),
  });

  // Nearest Available Settings schema
  const nearestAvailableSchema = Joi.object({
    nearestAvailableSettings: Joi.object({
      taskAllocationPriority: Joi.array()
        .items(Joi.string().valid("captive", "freelancer"))
        .default([]),
      calculateByRoadDistance: Joi.boolean().required(),
      maximumRadiusKm: Joi.number().min(0).required(),
      startAllocationBeforeTaskTimeMin: Joi.number().min(0).required(),
      autoCancelSettings: Joi.object({
        enabled: Joi.boolean().required(),
        timeForAutoCancelOnFailSec: Joi.number().min(0).required(),
      }).required(),
      considerAgentRating: Joi.boolean().required(),
    }).required(),
  });

  // One by One Settings schema
  const oneByOneSchema = Joi.object({
    oneByOneSettings: Joi.object({
      taskAllocationPriority: Joi.array()
        .items(Joi.string().valid("captive", "freelancer"))
        .default([]),
      requestExpirySec: Joi.number().min(0).required(),
      numberOfRetries: Joi.number().min(0).required(),
      startAllocationBeforeTaskTimeMin: Joi.number().min(0).required(),
      autoCancelSettings: Joi.object({
        enabled: Joi.boolean().required(),
        timeForAutoCancelOnFailSec: Joi.number().min(0).required(),
      }).required(),
      considerAgentRating: Joi.boolean().required(),
    }).required(),
  });

  // Send to All Settings schema
  const sendToAllSchema = Joi.object({
    sendToAllSettings: Joi.object({
      taskAllocationPriority: Joi.array()
        .items(Joi.string().valid("captive", "freelancer"))
        .default([]),
      maxAgents: Joi.number().min(1).required(),
      requestExpirySec: Joi.number().min(0).required(),
      startAllocationBeforeTaskTimeMin: Joi.number().min(0).required(),
      autoCancelSettings: Joi.object({
        enabled: Joi.boolean().required(),
        timeForAutoCancelOnFailSec: Joi.number().min(0).required(),
      }).required(),
      considerAgentRating: Joi.boolean().required(),
    }).required(),
  });

  // Round Robin Settings schema
  const roundRobinSchema = Joi.object({
    roundRobinSettings: Joi.object({
      taskAllocationPriority: Joi.array()
        .items(Joi.string().valid("captive", "freelancer"))
        .default([]),
      maxTasksAllowed: Joi.number().min(0).required(),
      radiusKm: Joi.number().min(0).required(),
      startAllocationBeforeTaskTimeMin: Joi.number().min(0).required(),
      samePickupRadiusMeters: Joi.number().min(0).required(),
      waitingTimeForPickupMin: Joi.number().min(0).required(),
      waitingTimeForDeliveryMin: Joi.number().min(0).required(),
      parkingTimeAtPickupMin: Joi.number().min(0).required(),
      shortestEtaIgnoreMin: Joi.number().min(0).required(),
      shortestTimeSlaMin: Joi.number().min(0).required(),
      maxPoolTimeDifferenceMin: Joi.number().min(0).required(),
      maxPoolTaskCount: Joi.number().min(0).required(),
      assignTaskToOffDutyAgents: Joi.boolean().required(),
      considerThisDistanceAsMaxDistance: Joi.boolean().required(),
      restartAllocationOnDecline: Joi.boolean().required(),
      autoCancelSettings: Joi.object({
        enabled: Joi.boolean().required(),
        timeForAutoCancelOnFailSec: Joi.number().min(0).required(),
      }).required(),
      considerAgentRating: Joi.boolean().required(),
    }).required(),
  });

  const fifoSchema = Joi.object({
    fifoSettings: Joi.object({
      considerAgentRating: Joi.boolean().required(),
      startAllocationBeforeTaskTimeMin: Joi.number().min(0).required(),

      // Distance Settings
      startRadiusKm: Joi.number().min(0).required(),
      radiusIncrementKm: Joi.number().min(0).required(),
      maximumRadiusKm: Joi.number().min(0).required(),

      // Time Settings
      batchProcessingTimeSec: Joi.number().min(0).required(),
      requestTimeSec: Joi.number().min(0).required(),

      // Batch Settings
      maximumBatchSize: Joi.number().min(0).required(),
      maximumBatchLimit: Joi.number().min(0).required(),

      enableClubbing: Joi.boolean().required(),

      // Clubbing Settings (conditionally validated if enableClubbing true)
      clubbingSettings: Joi.object({
        deliveryDistanceKm: Joi.number().min(0).required(),
        orderThresholdTimeSec: Joi.number().min(0).required(),
        additionalTasksToBeClubbed: Joi.number().min(0).required(),
      }).optional(), // optional unless toggled on UI
    }).required(),
  });

  let update = {};

  // Validate and set method first
  if (req.body.method) {
    const { error } = methodSchema.validate({ method: req.body.method });
    if (error)
      return res.status(400).json({ message: error.details[0].message });

    update.method = req.body.method;
  }

  // Check and validate based on method provided
  switch (req.body.method) {
    case "nearest_available":
      if (req.body.nearestAvailableSettings) {
        const { error } = nearestAvailableSchema.validate({
          nearestAvailableSettings: req.body.nearestAvailableSettings,
        });
        if (error)
          return res.status(400).json({ message: error.details[0].message });

        update.nearestAvailableSettings = req.body.nearestAvailableSettings;
      }
      break;

    case "one_by_one":
      if (req.body.oneByOneSettings) {
        const { error } = oneByOneSchema.validate({
          oneByOneSettings: req.body.oneByOneSettings,
        });
        if (error)
          return res.status(400).json({ message: error.details[0].message });

        update.oneByOneSettings = req.body.oneByOneSettings;
      }
      break;

    case "send_to_all":
      if (req.body.sendToAllSettings) {
        const { error } = sendToAllSchema.validate({
          sendToAllSettings: req.body.sendToAllSettings,
        });
        if (error)
          return res.status(400).json({ message: error.details[0].message });

        update.sendToAllSettings = req.body.sendToAllSettings;
      }
      break;

    case "round_robin":
      if (req.body.roundRobinSettings) {
        const { error } = roundRobinSchema.validate({
          roundRobinSettings: req.body.roundRobinSettings,
        });
        if (error)
          return res.status(400).json({ message: error.details[0].message });

        update.roundRobinSettings = req.body.roundRobinSettings;
      }
      break;
    case "fifo":
      if (req.body.fifoSettings) {
        const { error } = fifoSchema.validate({
          fifoSettings: req.body.fifoSettings,
        });
        if (error)
          return res.status(400).json({ message: error.details[0].message });

        update.fifoSettings = req.body.fifoSettings;
      }
      break;
    default:
      break;
  }

  // If no valid fields provided
  if (Object.keys(update).length === 0)
    return res.status(400).json({ message: "No valid settings provided" });

  try {
    const settings = await AllocationSettings.findOneAndUpdate(
      {},
      { $set: update },
      { new: true, upsert: true }
    );

    res.status(200).json({
      message: "Settings updated successfully",
      data: settings,
    });
  } catch (err) {
    console.error("Allocation Settings Update Error:", err);
    res
      .status(500)
      .json({ message: "Failed to update settings", error: err.message });
  }
};

exports.getAllocationSettings = async (req, res) => {
  try {
    const settings = await AllocationSettings.findOne({});

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "No allocation settings found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Allocation settings fetched successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error fetching allocation settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch allocation settings",
      error: error.message,
    });
  }
};

exports.updateAutoAllocationStatus = async (req, res) => {
  const schema = Joi.object({
    isAutoAllocationEnabled: Joi.boolean().required(),
  });

  const { error } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const settings = await AllocationSettings.findOneAndUpdate(
      {},
      { isAutoAllocationEnabled: req.body.isAutoAllocationEnabled },
      { new: true, upsert: true }
    );

    res
      .status(200)
      .json({ message: "Auto allocation status updated", data: settings });
  } catch (err) {
    console.error("Auto Allocation Toggle Error:", err);
    res
      .status(500)
      .json({ message: "Failed to update status", error: err.message });
  }
};

exports.toggleAutoAllocationStatus = async (req, res) => {
  try {
    // Get existing settings or create default
    let settings = await AllocationSettings.findOne();
    if (!settings) {
      settings = await AllocationSettings.create({
        isAutoAllocationEnabled: false,
      });
    }

    // Toggle the flag
    settings.isAutoAllocationEnabled = !settings.isAutoAllocationEnabled;

    await settings.save();

    res.status(200).json({
      message: `Auto allocation has been ${
        settings.isAutoAllocationEnabled ? "enabled" : "disabled"
      }`,
      data: settings,
    });
  } catch (err) {
    console.error("Auto Allocation Toggle Error:", err);
    res
      .status(500)
      .json({ message: "Failed to toggle status", error: err.message });
  }
};

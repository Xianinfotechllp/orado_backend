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
      calculateByRoadDistance: Joi.boolean().default(true),
      maximumRadiusKm: Joi.number().min(0).default(10),
      startAllocationBeforeTaskTimeMin: Joi.number().min(0).default(0),
      autoCancelSettings: Joi.object({
        enabled: Joi.boolean().default(false),
        timeForAutoCancelOnFailSec: Joi.number().min(0).default(0),
      }).default(),
      considerAgentRating: Joi.boolean().default(false),
    }).default(),
  });

  // One by One Settings schema
  const oneByOneSchema = Joi.object({
    oneByOneSettings: Joi.object({
      taskAllocationPriority: Joi.array()
        .items(Joi.string().valid("captive", "freelancer"))
        .default([]),
      requestExpirySec: Joi.number().min(0).default(30),
      numberOfRetries: Joi.number().min(0).default(0),
      startAllocationBeforeTaskTimeMin: Joi.number().min(0).default(0),
      autoCancelSettings: Joi.object({
        enabled: Joi.boolean().default(false),
        timeForAutoCancelOnFailSec: Joi.number().min(0).default(0),
      }).default(),
      considerAgentRating: Joi.boolean().default(false),
    }).default(),
  });

  // Send to All Settings schema
  const sendToAllSchema = Joi.object({
    sendToAllSettings: Joi.object({
         taskAllocationPriority: Joi.array()
      .items(Joi.string().valid("captive", "freelancer"))
      .default(["captive", "freelancer"]),
      maxAgents: Joi.number().min(1).max(500).default(500),
      requestExpirySec: Joi.number().min(0).default(30),
      startAllocationBeforeTaskTimeMin: Joi.number().min(0).default(0),
      radiusKm: Joi.number().min(0).default(5),
      maximumRadiusKm: Joi.number().min(0).default(20),
      radiusIncrementKm: Joi.number().min(0).default(2),
    }).default(),
  });

  // Batch Wise Settings schema
  const batchWiseSchema = Joi.object({
    batchWiseSettings: Joi.object({
      batchSize: Joi.number().min(1).default(5),
      batchLimit: Joi.number().min(1).default(5),
    }).default(),
  });

  // Round Robin Settings schema
  const roundRobinSchema = Joi.object({
    roundRobinSettings: Joi.object({
      maxTasksAllowed: Joi.number().min(1).default(20),
      radiusKm: Joi.number().min(0).default(10),
      radiusIncrementKm: Joi.number().min(0).default(2),
      maximumRadiusKm: Joi.number().min(0).default(10),
      startAllocationBeforeTaskTimeMin: Joi.number().min(0).default(0),
      considerAgentRating: Joi.boolean().default(false),
    }).default(),
  });

  // FIFO Settings schema
  const fifoSchema = Joi.object({
    fifoSettings: Joi.object({
      considerAgentRating: Joi.boolean().default(false),
      startAllocationBeforeTaskTimeMin: Joi.number().min(0).default(0),
      startRadiusKm: Joi.number().min(0).default(3),
      radiusIncrementKm: Joi.number().min(0).default(2),
      maximumRadiusKm: Joi.number().min(0).default(10),
      requestExpirySec: Joi.number().min(0).default(25),
    }).default(),
  });

  // Pooling Settings schema
  const poolingSchema = Joi.object({
    poolingSettings: Joi.object({
      poolSize: Joi.number().min(1).default(10),
    }).default(),
  });

  // Auto Allocation Enabled schema
  const autoAllocationSchema = Joi.object({
    isAutoAllocationEnabled: Joi.boolean().default(false),
  });

  let update = {};

  // Validate and set auto allocation enabled
  if (req.body.hasOwnProperty('isAutoAllocationEnabled')) {
    const { error } = autoAllocationSchema.validate({ 
      isAutoAllocationEnabled: req.body.isAutoAllocationEnabled 
    });
    if (error)
      return res.status(400).json({ message: error.details[0].message });

    update.isAutoAllocationEnabled = req.body.isAutoAllocationEnabled;
  }

  // Validate and set method
  if (req.body.method) {
    const { error } = methodSchema.validate({ method: req.body.method });
    if (error)
      return res.status(400).json({ message: error.details[0].message });

    update.method = req.body.method;
  }

  // Validate and set settings based on method
  // Note: We should validate ALL settings that are provided, not just based on method
  // This allows partial updates of settings for different methods

  // Validate Nearest Available Settings if provided
  if (req.body.nearestAvailableSettings) {
    const { error, value } = nearestAvailableSchema.validate({
      nearestAvailableSettings: req.body.nearestAvailableSettings,
    });
    if (error)
      return res.status(400).json({ message: error.details[0].message });

    update.nearestAvailableSettings = value.nearestAvailableSettings;
  }

  // Validate One by One Settings if provided
  if (req.body.oneByOneSettings) {
    const { error, value } = oneByOneSchema.validate({
      oneByOneSettings: req.body.oneByOneSettings,
    });
    if (error)
      return res.status(400).json({ message: error.details[0].message });

    update.oneByOneSettings = value.oneByOneSettings;
  }

  // Validate Send to All Settings if provided
  if (req.body.sendToAllSettings) {
    const { error, value } = sendToAllSchema.validate({
      sendToAllSettings: req.body.sendToAllSettings,
    });
    if (error)
      return res.status(400).json({ message: error.details[0].message });

    update.sendToAllSettings = value.sendToAllSettings;
  }

  // Validate Batch Wise Settings if provided
  if (req.body.batchWiseSettings) {
    const { error, value } = batchWiseSchema.validate({
      batchWiseSettings: req.body.batchWiseSettings,
    });
    if (error)
      return res.status(400).json({ message: error.details[0].message });

    update.batchWiseSettings = value.batchWiseSettings;
  }

  // Validate Round Robin Settings if provided
  if (req.body.roundRobinSettings) {
    const { error, value } = roundRobinSchema.validate({
      roundRobinSettings: req.body.roundRobinSettings,
    });
    if (error)
      return res.status(400).json({ message: error.details[0].message });

    update.roundRobinSettings = value.roundRobinSettings;
  }

  // Validate FIFO Settings if provided
  if (req.body.fifoSettings) {
    const { error, value } = fifoSchema.validate({
      fifoSettings: req.body.fifoSettings,
    });
    if (error)
      return res.status(400).json({ message: error.details[0].message });

    update.fifoSettings = value.fifoSettings;
  }

  // Validate Pooling Settings if provided
  if (req.body.poolingSettings) {
    const { error, value } = poolingSchema.validate({
      poolingSettings: req.body.poolingSettings,
    });
    if (error)
      return res.status(400).json({ message: error.details[0].message });

    update.poolingSettings = value.poolingSettings;
  }

  // If no valid fields provided
  if (Object.keys(update).length === 0) {
    return res.status(400).json({ message: "No valid settings provided" });
  }

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

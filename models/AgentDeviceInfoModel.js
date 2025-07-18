const mongoose = require("mongoose");

const agentDeviceInfoSchema = new mongoose.Schema({
  agent: { type: mongoose.Schema.Types.ObjectId, ref: "Agent", required: true },
  deviceId: { type: String, required: true },
  os: String,
  osVersion: String,
  appVersion: String,
  model: String,
  batteryLevel: Number,
  networkType: String,
  timezone: String,
  locationEnabled: Boolean,
  isRooted: Boolean,
  updatedAt: { type: Date, default: Date.now }
});

agentDeviceInfoSchema.index({ agent: 1, deviceId: 1 }, { unique: true }); // prevent duplicates

module.exports = mongoose.model("AgentDeviceInfo", agentDeviceInfoSchema);

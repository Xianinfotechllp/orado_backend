const mongoose = require("mongoose");

const deviceTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // or "Restaurant" — make polymorphic if needed
    required: true,
  },
  token: {
    type: String,
    required: true,
    unique: true, // avoid duplicates
  },
  platform: {
    type: String,
    enum: ['android', 'ios', 'web'],
  },
  deviceInfo: {
    type: String, // Optional: useful for debug or identifying device
  },
  lastUsed: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

module.exports = mongoose.model("DeviceToken", deviceTokenSchema);

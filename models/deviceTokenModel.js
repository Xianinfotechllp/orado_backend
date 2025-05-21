const mongoose = require("mongoose");

const deviceTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // or "Restaurant" if you’re assigning tokens to restaurants too — or make it polymorphic later
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
  platform: {
    type: String,
    enum: ['android', 'ios', 'web'],

  },
  lastUsed: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

module.exports = mongoose.model("DeviceToken", deviceTokenSchema);

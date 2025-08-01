const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
  userAgent: String,
  ip: String,
  expiresAt: Date,
}, { timestamps: true });

module.exports = mongoose.model("Session", sessionSchema);
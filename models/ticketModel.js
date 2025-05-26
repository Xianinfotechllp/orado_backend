const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  status: {
    type: String,
    enum: ["open", "in_progress", "resolved", "closed"],
    default: "open"
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium"
  },
  createdAt: { type: Date, default: Date.now },
  replies: [
    {
      sender: { type: String, enum: ["user", "admin"], required: true },
      message: String,
      timestamp: { type: Date, default: Date.now }
    }
  ]
});

module.exports = mongoose.model("Ticket", ticketSchema);

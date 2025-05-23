const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  category: { type: String }, // Optional: For grouping like "Orders", "Payments", etc.
  audience: { type: String, enum: ["user", "vendor", "admin", "all"], default: "all" },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model("FAQ", faqSchema);

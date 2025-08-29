const mongoose = require("mongoose");
const PreparationDelaySchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
  orderTime: { type: Date, required: true },
  expectedPrepTime: { type: Number, required: true },
  actualPrepTime: { type: Number },
  delayMinutes: { type: Number },
  status: { type: String, enum: ["On-time", "Delayed"], required: true },
  delayReason: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("PreparationDelay", PreparationDelaySchema);
const mongoose = require("mongoose");

const MerchantPayoutSchema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: "Merchant", required: true },
  totalAmount: Number,
  payoutType: { type: String, enum: ["online", "cod", "adjustment"], default: "online" },
  orders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
  status: { type: String, enum: ["initiated", "completed"], default: "initiated" },
  notes: String,
  payoutDate: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("MerchantPayout", MerchantPayoutSchema);

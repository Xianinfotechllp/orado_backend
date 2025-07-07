const mongoose = require("mongoose");

const CODCommissionReceivableSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: "Merchant", required: true },
  commissionAmount: Number,
  status: { type: String, enum: ["pending", "recovered"], default: "pending" },
  recoveredVia: { type: String, enum: ["onlinePayoutAdjustment", "manual"], default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});

module.exports = mongoose.model("CODCommissionReceivable", CODCommissionReceivableSchema);

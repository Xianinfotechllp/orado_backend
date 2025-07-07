const mongoose = require("mongoose");

const CommissionLedgerSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: "Merchant", required: true },
  paymentType: { type: String, enum: ["online", "cod"], required: true },
  commissionAmount: Number,
  additionalChargeCommissionAmount: Number,
  taxAmount: Number,
  totalEarning: Number, // merchant net
  adminEarning: Number, // platform net
  status: { type: String, enum: ["pending", "settled"], default: "pending" },
  payoutDate: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("CommissionLedger", CommissionLedgerSchema);

const mongoose = require("mongoose");

const walletTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["credit", "debit", "refund"], required: true },
  amount: { type: Number, required: true, min: [0, "Amount must be non-negative"] },
  status: { type: String, enum: ["pending", "success", "failed"], default: "pending" },
  description: { type: String, default: "" },
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  walletBalanceAfterTransaction: { type: Number }
}, { timestamps: true });

module.exports = mongoose.model("WalletTransaction", walletTransactionSchema);

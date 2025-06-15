const mongoose = require("mongoose");

const walletTransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  type: {
    type: String,
    enum: ["credit", "debit", "refund"],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: [0, "Amount must be non-negative"],
  },
  description: {
    type: String,
    default: "",
  },
}, { timestamps: true }); // Automatically tracks createdAt and updatedAt

module.exports = mongoose.model("WalletTransaction", walletTransactionSchema);

const mongoose = require("mongoose");

const loyaltyPointTransactionSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null, // null for adjustments like expiry etc.
    },

    description: {
      type: String,
      required: true, // eg: 'Earned from order', 'Redeemed', 'Expired'
    },

    points: {
      type: Number,
      required: true,
    },

    transactionType: {
      type: String,
      enum: ['earned', 'redeemed', 'expired'],
      required: true,
    },

    expiryDate: {
      type: Date, // only for earned points
      default: null,
    },

    status: {
      type: String,
      enum: ['active', 'redeemed', 'expired'],
      default: 'active',
    },
 amountValue: {
  type: Number
 },
    transactionCreatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LoyaltyPointTransaction", loyaltyPointTransactionSchema);

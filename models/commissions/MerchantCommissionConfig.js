const mongoose = require("mongoose");

const MerchantCommissionConfigSchema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: "Merchant", required: true },
  customCommissionValue: Number,
  commissionType: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
  customPayoutScheduleDays: Number,
  includeDeliveryCharges: Boolean,
  additionalChargeCommissionTo: { type: String, enum: ["admin", "merchant"], default: "admin" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("MerchantCommissionConfig", MerchantCommissionConfigSchema);

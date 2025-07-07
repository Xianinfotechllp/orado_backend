const mongoose = require("mongoose");

const CommissionSettingsSchema = new mongoose.Schema({
  defaultCommissionValue: Number,
  commissionType: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
  payoutScheduleDays: Number,
  includeDeliveryCharges: Boolean,
  additionalChargeCommissionTo: { type: String, enum: ["admin", "merchant"], default: "admin" },
  marketplaceTaxOwner: { type: String, enum: ["admin", "merchant"], default: "admin" },
  merchantTaxOwner: { type: String, enum: ["merchant", "admin"], default: "merchant" },
  productTaxOwner: { type: String, enum: ["admin", "merchant"], default: "admin" },
  promoLoyaltyDeductFrom: { type: String, enum: ["admin", "both"], default: "admin" },
  tierCommissionRules: [
    {
      minOrderValue: Number,
      maxOrderValue: Number,
      commissionValue: Number,
      commissionType: { type: String, enum: ["percentage", "fixed"], default: "percentage" }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("CommissionSettings", CommissionSettingsSchema);

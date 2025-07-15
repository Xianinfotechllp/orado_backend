const mongoose = require("mongoose");

const promoCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    required: false, // Optional — you can make it true if you want to enforce it
    trim: true
  },
  discountType: {
    type: String,
    enum: ["fixed", "percentage"],
    required: true
  },
  discountValue: {
    type: Number,
    required: true
  },
  minOrderValue: {
    type: Number,
    default: 0
  },
  validFrom: {
    type: Date,
    required: true
  },
  validTill: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isMerchantSpecific: {
    type: Boolean,
    default: false
  },
  applicableMerchants: [
    { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant" }
  ],
  isCustomerSpecific: {
    type: Boolean,
    default: false
  },
  applicableCustomers: [
    { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  ],
  maxUsagePerCustomer: {
    type: Number,
    default: 0 // 0 means unlimited
  },
  totalUsageCount: {
    type: Number,
    default: 0
  },
  customersUsed: [
    { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  ]
}, { timestamps: true });

module.exports = mongoose.model("PromoCode", promoCodeSchema);

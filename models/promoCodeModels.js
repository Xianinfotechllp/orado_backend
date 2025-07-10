const mongoose = require("mongoose");

const promoCodeSchema = new mongoose.Schema({
  language: {
    type: String,
    default: "en",
  },
  promotionType: {
    type: String,
    enum: ["Percentage", "Flat"],
    required: true,
  },
  promotionName: {
    type: String,
    required: true,
  },
  discountValue: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    maxlength: 150,
  },
  from: Date,
  till: Date,
  maximumDiscountValue: Number, // for percentage type promos
  maximumNoOfAllowedUsers: Number,
  minimumOrderAmount: Number,
  applicationMode: {
    type: String,
    enum: ["Public", "Hidden", "AutoApply"],
    default: "Public",
  },
  isReusableBySameUser: {
    type: Boolean,
    default: true,
  },
  allowLoyaltyRedeem: {
    type: Boolean,
    default: true,
  },
  allowLoyaltyEarn: {
    type: Boolean,
    default: true,
  },
promoAppliedOn: {
  type: String,
  enum: ['cartvalue', 'deliveryCharge', 'specificProducts'],
  required: true
},
  applicableOrderNumbers: [Number],
  assignedRestaurants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model("PromoCode", promoCodeSchema);

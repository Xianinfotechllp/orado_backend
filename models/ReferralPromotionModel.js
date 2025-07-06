const mongoose = require("mongoose");

const referralPromotionSchema = new mongoose.Schema(
  {
    language: {
      type: String,
      default: "English",
      enum: ["English", "Spanish", "French"], // Add more if needed
    },

    referralType: {
      type: String,
      enum: ["percentage", "flat"],
      required: true,
    },

    // Referrer fields
    referrerDiscountValue: {
      type: Number,
      required: true,
    },
    referrerMaxDiscountValue: {
      type: Number,
      default: 0,
    },
    referrerDescription: {
      type: String,
      required: true,
    },

    // Referee fields
    refereeDiscountValue: {
      type: Number,
      required: true,
    },
    refereeMaxDiscountValue: {
      type: Number,
      default: 0,
    },
    minOrderValue: {
      type: Number,
      default: 0,
    },
    refereeDescription: {
      type: String,
      required: true,
    },

    // Program Options
    status: {
      type: Boolean,
      default: true, // active by default
    },
    referralCodeOnSignup: {
      type: Boolean,
      default: true,
    },
    smartURL: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReferralPromotion", referralPromotionSchema);

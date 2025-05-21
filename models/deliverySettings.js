const mongoose = require("mongoose");

const deliverySettingsSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    default: null // null = global settings
  },
  baseCharge: Number,              // e.g. ₹30
  perKmCharge: Number,            // e.g. ₹5/km
  surgeMultiplier: {
    type: Number,
    default: 1
  },
  freeDeliveryAbove: Number,      // e.g. ₹300
  peakHours: [
    {
      start: String,              // "18:00"
      end: String                 // "21:00"
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("deliverySetting",deliverySettingsSchema)


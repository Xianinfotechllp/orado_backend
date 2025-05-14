const mongoose = require("mongoose");

const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    address: {
      street: String,
      city: String,
      state: String,
      zip: String,
     
    },
     location: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
      },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    openingHours: {
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
    },
    categories: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    ],
    products: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ],
    active: { type: Boolean, default: true },
    autoOnOff: { type: Boolean, default: true },
    foodType: {
      type: String,
      enum: ["veg", "non-veg", "both"],
      required: true,
    },
    banners: [String],
    merchantSearchName: { type: String },
    kycStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rating: { type: Number, default: 0 },
    serviceAreas: [
      {
        type: {
          type: String,
          enum: ["Polygon"],
          required: true,
          default: "Polygon",
        },
        coordinates: {
          type: [[[Number]]],
          required: true,
        },
      },
    ],
    minOrderAmount: { type: Number, required: true },
    paymentMethods: [
      { type: String, enum: ["cash", "online", "wallet"], required: true },
    ],
  },
  { timestamps: true }
);

// ✅ Create geospatial indexes
restaurantSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Restaurant", restaurantSchema);

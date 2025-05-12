const mongoose = require("mongoose");

const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to User model (merchant)
      required: true,
    },
    address: {
      street: String,
      city: String,
      state: String,
      zip: String,
      location: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], default: [0, 0] }, // [longitude, latitude]
      },
    },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    openingHours: {
      startTime: { type: String, required: true }, // "HH:mm"
      endTime: { type: String, required: true }, // "HH:mm"
    },
    categories: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Category" }, // Reference to Categories
    ],
    products: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product" }, // Reference to Products
    ],
    active: { type: Boolean, default: true }, // Merchant account status
    autoOnOff: { type: Boolean, default: true }, // Auto ON/OFF for opening hours
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
      default: "pending", // KYC verification status
    },
    rating: { type: Number, default: 0 }, // Restaurant rating
    serviceAreas: [
      { type: "Polygon", coordinates: [[Number, Number]] }, // Delivery zones
    ],
    minOrderAmount: { type: Number, required: true }, // Minimum order amount
    paymentMethods: [
      { type: String, enum: ["cash", "online", "wallet"], required: true },
    ], 
  },
  { timestamps: true }
);


restaurantSchema.index({ ownerId: 1 });
restaurantSchema.index({ "address.location": "2dsphere" });
restaurantSchema.index({ active: 1 });
restaurantSchema.index({ merchantSearchName: "text" }); 
restaurantSchema.index({ rating: -1 }); 

module.exports = mongoose.model("Restaurant", restaurantSchema);

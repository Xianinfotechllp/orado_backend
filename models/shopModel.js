const mongoose = require("mongoose");

const shopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    images: [String], // Shop images or banners

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

    categories: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    ],
    products: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ],

    active: { type: Boolean, default: true },
    kycStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    kycDocuments: {
      type: [String],
      default: [],
    },

    openingHours: {
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
    },

    businessHours: {
      type: Map,
      of: {
        startTime: { type: String }, // "HH:mm"
        endTime: { type: String },
        closed: { type: Boolean, default: false },
      },
      default: {},
    },

    serviceAreas: [
      {
        type: {
          type: String,
          enum: ["Polygon"],
          required: true,
          default: "Polygon",
        },
        coordinates: {
          type: [[[Number]]], // GeoJSON polygon coordinates
          required: true,
        },
      },
    ],

    minOrderAmount: { type: Number, default: 0 },

    paymentMethods: [
      { type: String, enum: ["cash", "online", "wallet"], required: true },
    ],

    permissions: {
      canAcceptOrders: { type: Boolean, default: false },
      canManageInventory: { type: Boolean, default: false },  // For shops
    },

    rating: { type: Number, default: 0 },

  },
  { timestamps: true }
);

// Index for geo queries
shopSchema.index({ location: "2dsphere" });
shopSchema.index({ serviceAreas: "2dsphere" });

module.exports = mongoose.model("Shop", shopSchema);

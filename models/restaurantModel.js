const mongoose = require("mongoose");

// ✅ Opening Hour Subdocument Schema
  const openingHourSchema = new mongoose.Schema({
    day: {
      type: String,
      enum: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      required: true,
    },
    openingTime: { type: String, required: true },
    closingTime: { type: String, required: true },
    isClosed: { type: Boolean, default: false },
  });

// ✅ Main Restaurant Schema
const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ownerName: String,
    phone: { type: String, required: true },
    email: { type: String, required: true },
    images: [String],
    banners: [String],

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

    serviceAreas: [
      {
        type: {
          type: String,
          enum: ["Polygon"],
          default: "Polygon",
          required: true,
        },
        coordinates: {
          type: [[[Number]]], // Array of Polygon coordinates
          required: true,
        },
      },
    ],

    offers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Offer" }],
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],

    points: {
      totalPoints: { type: Number, default: 0 },
      lastAwardedDate: { type: Date },
    },
    pointsHistory: [
      {
        points: Number,
        reason: String,
        date: { type: Date, default: Date.now },
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
          default: null,
        },
      },
    ],

    storeType: {
      type: String,
      enum: ["restaurant", "grocery", "meat", "pharmacy"],
      required: true,
    },

    openingHours: [openingHourSchema],
    foodType: {
      type: String,
      enum: ["veg", "non-veg", "both"],
      required: true,
    },

    kyc: {
      fssaiNumber: String,
      gstNumber: String,
      aadharNumber: String,
    },
    kycDocuments: {
      fssaiDocUrl: String,
      gstDocUrl: String,
      aadharDocUrl: String,
    },
    kycStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    kycRejectionReason: { type: String, default: null },
    approvalRejectionReason: { type: String, default: null },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    permissions: {
      canManageMenu: { type: Boolean, default: false },
      canAcceptOrder: { type: Boolean, default: false },
    },

    rating: { type: Number, default: 0 },

    // city: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "City",
    //   required: false
    // },

    minOrderAmount: { type: Number },
    commission: {
      type: {
        type: String,
        enum: ["percentage", "fixed"],
        default: "percentage",
      },
      value: { type: Number, default: 20 },
    },

    preparationTime: { type: Number, default: 20 }, // in minutes

    paymentMethods: [
      { type: String, enum: ["cod", "cash", "online", "wallet"] },
    ],

    devices: [
      {
        token: {
          type: String,
        },
        platform: {
          type: String,
          enum: ["android", "ios", "web", "pos_system"],
        },
        deviceId: {
          type: String,
        },
        lastActive: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ["active", "inactive", "maintenance"],
          default: "active",
        },
      },
    ],
    active: { type: Boolean, default: true },
    autoOnOff: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ✅ Indexes for Geospatial Queries
restaurantSchema.index({ location: "2dsphere" });
restaurantSchema.index({ serviceAreas: "2dsphere" });

module.exports = mongoose.model("Restaurant", restaurantSchema);

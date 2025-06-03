const mongoose = require("mongoose");

const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    ownerName:String,
    images: [String], // URLs of images (e.g. Cloudinary URLs)

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
    // offers-added
    offers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Offer'
      }
    ]
    ,
    points: {
      totalPoints: { type: Number, default: 0 },
      lastAwardedDate: { type: Date },
    },
    pointsHistory: [
      {
        points: Number,
        reason: String,
        date: { type: Date, default: Date.now },
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null }
      }
    ]
    ,
    openingHours: {
      startTime: { type: String },
      endTime: { type: String },
    },

    businessHours: {
      type: Map,
      of: {
        startTime: { type: String }, // "HH:mm"
        endTime: { type: String },
        closed: { type: Boolean, default: false } // optional field to mark a day closed
      },
      default: {}
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
    kyc: {
    fssaiNumber: { type: String, required: true },
    gstNumber: { type: String, required: true },
    aadharNumber: { type: String, required: true },
    },
    kycDocuments: {
      fssaiDocUrl: { type: String, required: true },
      gstDocUrl: { type: String, required: true },
      aadharDocUrl: { type: String, required: true },
    },
    kycStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    kycRejectionReason: {
      type: String,
      default: null,
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },
    permissions: {
      canAcceptOrders: { type: Boolean, default: false },
      canManageMenu: { type: Boolean, default: false },
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
restaurantSchema.index({ serviceAreas: "2dsphere" });

module.exports = mongoose.model("Restaurant", restaurantSchema);

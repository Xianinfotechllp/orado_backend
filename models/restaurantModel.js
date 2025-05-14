const mongoose = require("mongoose");

const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to User model (merchant)
      required: true,
    },
    images: [String], // URLs of images (e.g. Cloudinary URLs)

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
    // offers-added
    offers: [
  {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer'
  }
]
,
    openingHours: {
      startTime: { type: String, required: true }, // "HH:mm"
      endTime: { type: String, required: true }, // "HH:mm"
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
        {
          type: {
            type: String,
            enum: ['Polygon'],
            required: true,
            default: 'Polygon'
          },
          coordinates: {
            type: [[[Number]]], // Array of arrays of positions [ [ [lng, lat], [lng, lat], ... ] ]
            required: true
          }
        }
      ],
    minOrderAmount: { type: Number, required: true }, // Minimum order amount
    paymentMethods: [
      { type: String, enum: ["cash", "online", "wallet"], required: true },
    ], 
  },
  { timestamps: true }
);


 

module.exports = mongoose.model("Restaurant", restaurantSchema);

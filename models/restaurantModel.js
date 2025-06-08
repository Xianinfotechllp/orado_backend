const mongoose = require("mongoose");
const openingHourSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true
  },
  openingTime: {
    type: String, // e.g. '09:00'
    required: true
  },
  closingTime: {
    type: String, // e.g. '22:00'
    required: true
  },
  isClosed: {
    type: Boolean,
    default: false
  }
});
const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    ownerName:String,

     ownerId: {  // Add this field
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    ownerName: String,



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
     openingHours: [openingHourSchema],

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
    fssaiNumber: { type: String },
    gstNumber: { type: String},
    aadharNumber: { type: String},
    },
    kycDocuments: {
      fssaiDocUrl: { type: String },
      gstDocUrl: { type: String},
      aadharDocUrl: { type: String},
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
     approvalRejectionReason: {
      type: String,
      default: null,
    },
    
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },
    permissions: {
    canManageMenu: {
      type: Boolean,
      default: false
    },
    canAcceptOrder: {
      type: Boolean,
      default: false
    },
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
    minOrderAmount: { type: Number },
    paymentMethods: [
      { type: String, enum: ["cash", "online", "wallet"] },
    ],
  },
  { timestamps: true }
);

// ✅ Create geospatial indexes
restaurantSchema.index({ location: "2dsphere" });
restaurantSchema.index({ serviceAreas: "2dsphere" });

module.exports = mongoose.model("Restaurant", restaurantSchema);

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

    ownerId: { 
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true 
    },
    images: [String],
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
    ownerName:String,
    phone: { type: String, required: true },
    email: { type: String, required: true },
  
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
    commission: {
  type: {
    type: String,
    enum: ["percentage", "fixed"],
    default: "percentage"
  },
  value: {
    type: Number,
    default: 20 // 20% commission
  }
}, preparationTime: {
    type: Number, // in minutes
    default: 20,
  },
    paymentMethods: [
      { type: String, enum: ['cod',"cash", "online", "wallet"] },
    ],
  },
  
  
  { timestamps: true }
);

// ✅ Create geospatial indexes
restaurantSchema.index({ location: "2dsphere" });
restaurantSchema.index({ serviceAreas: "2dsphere" });

module.exports = mongoose.model("Restaurant", restaurantSchema);

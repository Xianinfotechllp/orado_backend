const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Home", "Work", "Other", "FriendAndFamily"],
      default: "Home",
    },
    displayName: {
      type: String,
      trim: true,
    },
    street: {
      type: String,
      required: true,
      trim: true,
    },
    area: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    zip: {
      type: String,
      required: true,
      trim: true,
    },
    receiverName: {
      type: String,
      trim: true,
    },
    receiverPhone: {
      type: String,
      trim: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        default: [0, 0],
      },
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    directionsToReach: {
      type: String,
      trim: true,
    },
  },
  { _id: true, timestamps: true }
);


addressSchema.index({ location: "2dsphere" });

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    userType: {
      type: String,
      enum: ["customer", "agent", "merchant", "admin", "superAdmin"], // Added superAdmin
      default: "customer",
      required: true,
    },

    // Super Admin  Flag
    isSuperAdmin: { type: Boolean, default: false },

    //  Admin Permission System
    adminPermissions: {
      type: [String], // e.g. ['orders.manage', 'restaurants.approve']
      default: [],
    },

    isAgent: { type: Boolean, default: false },
    agentApplicationStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },
    profilePicture: { type: String }, // Kept only one, removed duplicate
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: "Agent" },

    agentApplicationDocuments: {
      license: { type: String },
      insurance: { type: String },
      submittedAt: { type: Date },
    },

    addresses: [addressSchema], 

    active: { type: Boolean, default: true },

    verification: {
      phoneOtp: String,
      emailOtp: String,
      otpExpiry: Date,
      emailVerified: { type: Boolean, default: false },
      phoneVerified: { type: Boolean, default: false },
    },

    bankDetails: {
      accountNumber: String,
      ifscCode: String,
      accountHolderName: String,
    },

    gst: String,
    fssai: String,

    fraudulent: { type: Boolean, default: false },
    codEnabled: { type: Boolean, default: false },

    subscription: {
      planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
      startDate: Date,
      endDate: Date,
    },

    walletBalance: { type: Number, default: 0 },
      loyaltyPoints: { type: Number, default: 0 },

    coupons: [
      {
        code: String,
        expiryDate: Date,
      },
    ],
    passwordChangedAt:Date,

    deviceTokens: [String],
    lastActivity: Date,

    resetPasswordToken: String,
    resetPasswordExpires: Date,

    

    loginAttempts: {
      count: { type: Number, default: 0 },
      lastAttempt: Date,
    },


devices: [
      {
        token: {
          type: String,
          required: true,
       
        },
        platform: {
          type: String,
          enum: ['android', 'ios', 'web'],
          
        },
        deviceId: {
          type: String,
          
        },
        fcmToken: {
          type: String,
        
        },
        status: {
          type: String,
          enum: ['active', 'inactive'],
          default: 'active'
        },
        lastActive: {
          type: Date,
          default: Date.now
        },
        appVersion: String,
        osVersion: String,
        // Additional metadata if needed
        metadata: mongoose.Schema.Types.Mixed
      }
    ]







  },
  { timestamps: true }
);



module.exports = mongoose.model("User", userSchema);

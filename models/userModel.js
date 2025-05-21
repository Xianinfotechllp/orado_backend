const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    userType: {
      type: String,
      enum: ["customer", "agent", "merchant", "admin"],
      default: "customer",
      required: true,
    },

    isAgent: { type: Boolean, default: false }, // Set to true when approved
    agentApplicationStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },
    profilePicture: { type: String }, // URL or file path
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: "Agent" }, // Set after approval

    agentApplicationDocuments: {
      license: { type: String },   // URL or file path
      insurance: { type: String }, // URL or file path
      submittedAt: { type: Date }, // Optional: to track submission time
    },

    address: {
      street: String,
      city: String,
      state: String,
      zip: String,
      location: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point"
        },
        coordinates: {
          type: [Number],
          default: [0, 0]
        }
      }
    },

    active: { type: Boolean, default: true },
    profilePicture: { type: String },

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
  notificationPrefs: {
    orderUpdates: { type: Boolean, default: true },
    promotions: { type: Boolean, default: true },
    walletCredits: { type: Boolean, default: true },
    newFeatures: { type: Boolean, default: true },
    serviceAlerts: { type: Boolean, default: true }
  },
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

    deviceTokens: [String],
    lastActivity: Date,

    resetPasswordToken: String,
    resetPasswordExpires: Date,

    

    loginAttempts: {
      count: { type: Number, default: 0 },
      lastAttempt: Date,
    },


  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);

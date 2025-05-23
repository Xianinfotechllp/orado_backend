const mongoose = require("mongoose");
const shortid = require("shortid");

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
    // for-refferal
    referralCode: {
      type: String,
      unique: true, // each user has a unique code to refer others
    },

    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // reference to the user who referred this one
    },

    referralLevel: {
      type: Number,
      default: 1 // optional: track hierarchy level if you want MLM-style depth
    },


    // 🔥Super Admin  Flag
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

    merchantApplication: {
      aadhaarCard: { type: String },
      aadhaarNumber: { type: String },
      fssaiLicense: { type: String },
      fssaiNumber: { type: String },
      gstCertificate: { type: String },
      gstNumber: { type: String },
      submittedAt: { type: Date },
      status: {
        type: String,
        enum: ["none", "pending", "approved", "rejected"],
        default: "none"
      }
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

// ✅ Referral Code Auto-Generation Middleware
userSchema.pre("save", function (next) {
  if (!this.referralCode) {
    this.referralCode = shortid.generate().toUpperCase();
  }
  next();
});



module.exports = mongoose.model("User", userSchema);

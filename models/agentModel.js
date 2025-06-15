const mongoose = require("mongoose");

const agentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    fullName: { type: String, required: true },
    phoneNumber: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    profilePicture: { type: String }, // URL to the profile picture
    bankAccountDetails: {
      accountNumber: { type: String },
      bankName: { type: String },
      accountHolderName: { type: String },
      ifscCode: { type: String },
    },
    bankDetailsProvided: {
      type: Boolean,
      default: false,
    },
    payoutDetails: {
      totalEarnings: { type: Number, default: 0 },
      tips: { type: Number, default: 0 },
      surge: { type: Number, default: 0 },
      incentives: { type: Number, default: 0 },
      totalPaid: { type: Number, default: 0 }, // Total amount paid out so far
      pendingPayout: { type: Number, default: 0 }, // Pending payout amount
    },
    dashboard: {
      totalDeliveries: { type: Number, default: 0 },
      totalCollections: { type: Number, default: 0 },
      totalEarnings: { type: Number, default: 0 },
      tips: { type: Number, default: 0 },
      surge: { type: Number, default: 0 },
      incentives: { type: Number, default: 0 },
    },
    points: {
      totalPoints: { type: Number, default: 0 },
      lastAwardedDate: { type: Date },
    },

    deliveryStatus: {
      currentOrderId: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }], // current order they are delivering
      status: { type: String, enum: ["assigned_to_agent", "picked_up", "in_progress", "completed", "cancelled_by_customer", "pending_agent_acceptance", "arrived", "available"], default: "available" },
      estimatedDeliveryTime: { type: Date }, // estimated time of arrival
      location: {
        latitude: { type: Number },
        longitude: { type: Number }
      }, 
      accuracy: { type: Number }, // accuracy of the GPS location (in meters)
      currentOrderCount: { type: Number, default: 0 },

    },

     location: {
      type: {
        type: String,
        enum: ['Point'],
        // required: true
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        // required: true
      }
    },
    leaveStatus: {
      leaveApplied: { type: Boolean, default: false },
      leaveStartDate: { type: Date },
      leaveEndDate: { type: Date },
      leaveType: { type: String, enum: ["Sick", "Personal", "Vacation"] },
      status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
    },
    attendance: {
      daysWorked: { type: Number, default: 0 },
      daysOff: { type: Number, default: 0 },
      attendanceLogs: [
        {
          date: { type: Date, required: true },
          status: { type: String, enum: ["Present", "Absent"], default: "Present" },
          clockIn: { type: Date },
          clockOut: { type: Date },
        }
      ]
    },
    qrCode: { type: String }, // URL or data for generating agent's personal QR code
    incentivePlans: [
      {
        planName: { type: String, required: true },
        conditions: { type: String }, // e.g., 'Complete 10 deliveries to earn $50'
        rewardAmount: { type: Number, required: true },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
      }
    ],
    documents: {
      license: { type: String },
      insurance: { type: String },
    },
    feedback: {
      averageRating: { type: Number, default: 0, min: 0, max: 5 },
      totalReviews: { type: Number, default: 0 },
      reviews: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
          orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
          rating: { type: Number, required: true, min: 1, max: 5 },
          comment: { type: String },
          createdAt: { type: Date, default: Date.now }
        }
      ]
    },
    permissions: {
      canAcceptOrRejectOrders: { type: Boolean, default: false },
      maxActiveOrders: { type: Number, default: 3 },
      maxCODAmount: { type: Number, default: 1000 },
      canChangeMaxActiveOrders: { type: Boolean, default: false },
      canChangeCODAmount: { type: Boolean, default: false },
    },
    permissionRequests: [ 
      {
        permissionType: {
          type: String,
          enum: ["canAcceptOrRejectOrders", "canChangeMaxActiveOrders", "canChangeCODAmount"],
          required: true
        },
        requestedAt: { type: Date, default: Date.now },
        status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
        responseDate: { type: Date },
        adminComment: { type: String } // Optional: for feedback
      }
    ],
    codTracking: {
      currentCODHolding: { type: Number, default: 0 }, // how much cash the agent is currently holding
      lastUpdated: { type: Date, default: Date.now },  // useful for audits or resets
      dailyCollected: { type: Number, default: 0 },    // reset daily for reporting or limits
    },
    cashDropLogs: [
      {
        amount: { type: Number, required: true },
        droppedAt: { type: Date, default: Date.now },
        method: { type: String, enum: ["Bank", "Online"], default: "Online" },
        notes: { type: String }
      }
    ],

 
    availabilityStatus: { type: String, enum: ["Available", "Unavailable"], default: "Unavailable" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  
  { timestamps: true }
);
agentSchema.index({ location: "2dsphere" });
module.exports = mongoose.model("Agent", agentSchema);

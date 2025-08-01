const mongoose = require("mongoose");
const mongoosePaginate = require('mongoose-paginate-v2');
const agentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    fullName: { type: String, required: true },
    phoneNumber: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    profilePicture: { type: String }, // URL to the profile picture

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

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

    // deliveryStatus: {
    //   currentOrderId: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }], // current order(s)
    //   status: {
    //     type: String,
    //     enum: [
    //       "assigned_to_agent",
    //       "picked_up",
    //       "in_progress",
    //       "completed",
    //       "cancelled_by_customer",
    //       "pending_agent_acceptance",
    //       "arrived",
    //       "available",
    //     ],
    //     default: "available",
    //   },
    //   estimatedDeliveryTime: { type: Date }, // estimated time of arrival
    //   // location: {
    //   //   latitude: { type: Number },
    //   //   longitude: { type: Number },
    //   // },
    //   accuracy: { type: Number }, // GPS accuracy in meters
    //   currentOrderCount: { type: Number, default: 0 },
    // },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
      accuracy: {
        type: Number, // in meters
        default: 0,
      },
  },

    fcmTokens: [
  {
    token: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
],


  leaves: [ 
  {
    leaveStartDate: { type: Date, required: true },
    leaveEndDate: { type: Date, required: true },
    leaveType: {
      type: String,
      enum: [
        "Sick",         // For health-related issues
        "Personal",     // For personal matters
        "Vacation",     // Planned time off
        "Emergency",    // Unexpected urgent leave
        "Family",       // Family-related occasions
        "Festival",     // Religious/cultural holidays
        "Unplanned"     // For unspecified short leaves
      ],
      required: true
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500 // optional limit
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending"
    },
    appliedAt: { type: Date, default: Date.now },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    rejectionReason: { type: String }
  }
]
,

    attendance: {
      daysWorked: { type: Number, default: 0 },
      daysOff: { type: Number, default: 0 },
      attendanceLogs: [
        {
          date: { type: Date, required: true },
          status: {
            type: String,
            enum: ["Present", "Absent"],
            default: "Present",
          },
          clockIn: { type: Date },
          clockOut: { type: Date },
        },
      ],
    },

    qrCode: { type: String }, // URL or data for personal QR code

    incentivePlans: [
      {
        planName: { type: String, required: true },
        conditions: { type: String }, // e.g., 'Complete 10 deliveries to earn $50'
        rewardAmount: { type: Number, required: true },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
      },
    ],

    // documents: {
    //   license: { type: String },
    //   insurance: { type: String },
    // },

    applicationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    role: {
      type: String,
      enum: ["agent", "admin", "super_admin"], // more roles if needed
      default: "agent",
    },

    agentApplicationDocuments: {
      license: { type: String },
      insurance: { type: String },
      rcBook: { type: String }, // ✅ new
      pollutionCertificate: { type: String }, // ✅ new
      submittedAt: { type: Date },
    },

    feedback: {
      averageRating: { type: Number, default: 0, min: 0, max: 5 },
      totalReviews: { type: Number, default: 0 },
      reviews: [
        {
          userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
          },
          rating: { type: Number, required: true, min: 1, max: 5 },
          comment: { type: String },
          createdAt: { type: Date, default: Date.now },
        },
      ],
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
          enum: [
            "canAcceptOrRejectOrders",
            "canChangeMaxActiveOrders",
            "canChangeCODAmount",
          ],
          required: true,
        },
        requestedAt: { type: Date, default: Date.now },
        status: {
          type: String,
          enum: ["Pending", "Approved", "Rejected"],
          default: "Pending",
        },
        responseDate: { type: Date },
        adminComment: { type: String }, // Optional feedback from admin
      },
    ],

    codTracking: {
      currentCODHolding: { type: Number, default: 0 },
      lastUpdated: { type: Date, default: Date.now },
      dailyCollected: { type: Number, default: 0 },
    },

    codSubmissionLogs: [  // ← renamed from cashDropLogs
  {
    droppedAmount: { type: Number, required: true }, // Amount that was submitted
    droppedAt: { type: Date, default: Date.now },     // When the COD was submitted
   dropMethod: {
  type: String,
  enum: [
    "CashDropAtHub",         // Physical cash drop
    "OnlineTransfer",        // UPI, NEFT, IMPS, etc.
    "POSMachine",            // Swiping on company POS
    "CourierPickup",         // Cash picked up
    "ManualAdjustment",      // Admin manually adjusts
    "AutoDeductFromPayout",  // System deducts from agent's earnings
    "ThirdPartyCollection"   // Via 3rd-party
  ]
},
    dropNotes: { type: String },                      // Optional notes from agent
    isVerifiedByAdmin: { type: Boolean, default: false }, // Whether admin confirmed it
    verifiedAt: { type: Date },                       // When admin verified
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    dropLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
    },
  }
],

    warnings: [
      {
        reason: { type: String, required: true },
        severity: {type: String, enum: ["minor", "major", "critical"], default: "minor"},
        issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        issuedAt: { type: Date, default: Date.now }
      }
    ],
    termination: {
      terminated: { type: Boolean, default: false },
      terminatedAt: { type: Date },
      issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      reason: { type: String },
      letter: { type: String }, // Can be a message, or URL if file
    },

//  agentDeliveryStatus: {
//     type: String,
//     enum: [
//       'start_journey_to_restaurant', // 🧭 Agent should start heading to the restaurant
//       'reached_restaurant',          // 🏁 Agent reached restaurant, can pick up
//       'picked_up',                   // 📦 Order picked
//       'out_for_delivery',            // 🚚 En route to customer
//       'reached_customer',            // 📍 Agent at customer location
//       'delivered',                   // ✅ Completed
//       'cancelled'                    // ❌ Cancelled by system/admin/user
//     ],
//     default: 'start_journey_to_restaurant'
//   },

//     // activityStatus: {
//     //   type: String,
//     //   enum: ["Free", "Busy", "Inactive"],
//     //   default: "Inactive",
//     // },

//     agentAssignmentStatus: {
//       type: String,
//       enum: [
//         "unassigned", // No agent has been assigned yet
//         "awaiting_agent_acceptance", // Agent assigned and waiting to accept/reject
//         "auto_accepted", // Agent auto-assigned (no permission to reject)
//         "accepted_by_agent", // Agent accepted the assignment manually
//         "rejected_by_agent", // Agent rejected the assignment
//         "manually_assigned_by_admin", // Admin manually assigned agent (treated as accepted)
//         "reassigned_to_another", // Reassigned to a different agent
//       ],
//     },
lastManualAssignmentAt: { type: Date, default: null },

lastAssignmentType: {
  type: String,
  enum: ["manual", "auto"],
  default: null,
},


    
agentAssignmentStatusHistory: [
  {
    status: {
      type: String,
      enum: [
        "unassigned",
        "awaiting_agent_acceptance",
        "auto_accepted",
        "accepted_by_agent",
        "rejected_by_agent",
        "manually_assigned_by_admin",
        "reassigned_to_another"
      ],
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
  }
],


    agentDeliveryTimestamps: {
  start_journey_to_restaurant: Date,
  reached_restaurant: Date,
  picked_up: Date,
  out_for_delivery: Date,
  reached_customer: Date,
  delivered: Date,
},

    lastAssignedAt: { type: Date, default: null },

    agentStatus: {
        status: {
          type: String,
          enum: [
            "OFFLINE",
            "AVAILABLE",
            "ORDER_ASSIGNED",
            "ORDER_ACCEPTED",
            "ARRIVED_AT_RESTAURANT",
            "PICKED_UP",
            "ON_THE_WAY",
            "AT_CUSTOMER_LOCATION",
            "DELIVERED",
            "ON_BREAK",
          ],
          default: "OFFLINE",
        },
        availabilityStatus: {
          type: String,
          enum: ["AVAILABLE", "UNAVAILABLE"],
          default: "UNAVAILABLE",
        },
      },
  },
  { timestamps: true }
);
agentSchema.plugin(mongoosePaginate);
agentSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Agent", agentSchema);

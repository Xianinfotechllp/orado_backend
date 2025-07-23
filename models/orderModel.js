const mongoose = require('mongoose');
const mongoosePaginate = require("mongoose-paginate-v2");






const agentCandidateSchema = new mongoose.Schema({
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
  },
  status: {
    type: String,
    enum: ['waiting', 'pending', 'accepted', 'rejected', 'timed_out'],
    default: 'waiting', // All will be waiting initially
  },
  assignedAt: Date,     // Only set when moved to 'pending'
  respondedAt: Date,
});











const orderSchema = mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' },

  orderItems: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: Number,
    price: Number,
    name: String,
    totalPrice: Number, // price * quantity
    image: String, 

  }],

onlinePaymentDetails: {
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  verificationStatus: { type: String, enum: ['pending', 'verified', 'failed'], default: 'pending' },
  failureReason: { type: String }
},










  orderTime: { type: Date, default: Date.now },
  deliveryTime: Date,

    orderStatus: {
      type: String,
      default: 'pending',
      enum: [
        'pending', 'pending_agent_acceptance', 'accepted_by_restaurant', 'rejected_by_restaurant',
        'preparing', 'ready', 'assigned_to_agent', 'picked_up', 'on_the_way','in_progress',
        'arrived', 'completed',"delivered", 'cancelled_by_customer', "awaiting_agent_assignment", "rejected_by_agent"
      ]
    },
allocationMethod: {
  type: String,
  enum: ['manual', 'one_by_one', 'nearest', 'fifo', 'broadcast'],
  default: 'one_by_one', // or whatever you want as default
},
  assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' }, 

   agentCandidates: [agentCandidateSchema],
agentAssignedAt: { type: Date },

agentAssignmentStatus: {
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
  default: "unassigned"
},


agentAssignmentTimestamp: {
  type: Date
},
agentDeliveryStatus: {
  type: String,
  enum: [
    'awaiting_start',              // ⏳ Agent assigned but not started yet (NEW)
    'start_journey_to_restaurant', // 🧭 Agent should start heading to the restaurant
    'reached_restaurant',          // 🏁 Agent reached restaurant
    'picked_up',                   // 📦 Order picked
    'out_for_delivery',            // 🚚 On the way to customer
    'reached_customer',            // 📍 Reached customer location
    'delivered',                   // ✅ Completed
    'cancelled'                    // ❌ Cancelled
  ],
  default: 'awaiting_start'
},
 agentDeliveryTimestamps: {
  start_journey_to_restaurant: Date,
  reached_restaurant: Date,
  picked_up: Date,
  out_for_delivery: Date,
  reached_customer: Date,
  delivered: Date,
},


  rejectionHistory: [{
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: "Agent" },
    rejectedAt: { type: Date, default: Date.now },
    reason: { type: String } 
  }],

  agentAcceptedAt: { type: Date },

  subtotal: Number,
  discountAmount: Number,
  tax: Number,
  deliveryCharge: Number,
  surgeCharge: Number,
  tipAmount: Number,
  totalAmount: Number,
  distanceKm: Number,

offerId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Offer',
  default: null
},
offerName: {
  type: String,
  default: null
},
offerDiscount: {
  type: Number,
  default: 0
},

cartTotal: Number,






  paymentMethod: { type: String, enum: ['cash', 'online', 'wallet'] },
  walletUsed: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ['pending', 'completed', 'failed'] },

  deliveryMode: { type: String, enum: ['contact', 'no_contact', 'do_not_disturb'] },


  instructions: {
  type: String,
  default: "",
  },
  orderPreparationDelay: Boolean,
  scheduledTime: Date,
  couponCode: String,

  customerReview: String,
  customerReviewImages: [String],
  restaurantReview: String,
  restaurantReviewImages: [String],

  cancellationReason: String,
  debtCancellation: Boolean,
 preparationTime: {
    type: Number, // in minutes
    default: 20,
  },
  preparationDelayReason: {
  type: String,
  default: ""
},

taxDetails: [{
  name: { type: String }, // eg. 'CGST', 'SGST', 'Service Tax'
  percentage: { type: Number },
  amount: { type: Number }
}],
  deliveryLocation: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function (val) {
          return val.length === 2;
        },
        message: 'Coordinates must be [longitude, latitude]',
      },
    }
  },

  deliveryAddress: {
    street: { type: String, required: true },
    area: { type: String },
    landmark: { type: String },
    city: { type: String, required: true },
    state: { type: String },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' },
  },

  guestName: { type: String },
  guestPhone: { type: String },
  guestEmail: { type: String },

}, { timestamps: true });
orderSchema.plugin(mongoosePaginate);
orderSchema.index({ deliveryLocation: '2dsphere' });

module.exports = mongoose.model('Order', orderSchema);

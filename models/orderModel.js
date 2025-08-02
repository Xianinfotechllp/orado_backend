const mongoose = require('mongoose');
const mongoosePaginate = require("mongoose-paginate-v2");

// Agent candidate sub-schema
const agentCandidateSchema = new mongoose.Schema({
agent: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Agent',
  required: true,
},
status: {
  type: String,
  enum: ['waiting', 'pending', 'accepted', 'rejected', 'timed_out'],
  default: 'waiting',
},
assignedAt: Date,
respondedAt: Date,
});

// Order schema
const orderSchema = new mongoose.Schema({
customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' },
cartId:{type: mongoose.Schema.Types.ObjectId, ref:"Cart"},
orderItems: [{
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  quantity: Number,
  price: Number,
  name: String,
  totalPrice: Number,
  image: String,
}],

// Payment
paymentMethod: { type: String, enum: ['cash', 'online', 'wallet'] },
walletUsed: { type: Number, default: 0 },
paymentStatus: { type: String, enum: ['pending', 'completed', 'failed'] },
onlinePaymentDetails: {
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  verificationStatus: { type: String, enum: ['pending', 'verified', 'failed'], default: 'pending' },
  failureReason: String
},

// Offer / Discount
offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', default: null },
offerName: { type: String, default: null },
offerType: { type: String, default: null }, // 'combo', 'flat', 'percentage', etc.
offerDiscount: { type: Number, default: 0 },
couponCode: { type: String, default: null },
couponDiscount: { type: Number, default: 0 },
comboBreakdown: [
  {
    comboId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
    name: String,
    products: [{
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      quantity: Number
    }],
    comboPrice: Number,
    regularPrice: Number,
    discount: Number
  }
],
comboDiscount: { type: Number, default: 0 },
flatDiscount: { type: Number, default: 0 },
percentageDiscount: { type: Number, default: 0 },
bogoDiscount: { type: Number, default: 0 },
totalDiscount: { type: Number, default: 0 },

// Charges
subtotal: Number,
cartTotal: Number,
tax: Number,
totalTaxAmount: Number,
deliveryCharge: Number,
surgeCharge: Number,
tipAmount: Number,
grandTotal: Number,
totalAmount: Number,

// Breakdown
chargesBreakdown: {
  packingCharges: [{
    name: { type: String },
    amount: { type: Number, default: 0 },
    description: { type: String, default: 'Packing Charge' }
  }],
  totalPackingCharge: { type: Number, default: 0 },
  additionalCharges: [{
    name: String,
    type: { type: String, enum: ['Fixed', 'Percentage'] },
    rate: String,
    amount: Number
  }],
  totalAdditionalCharges: { type: Number, default: 0 }
},

// Delivery
deliveryMode: { type: String, enum: ['contact', 'no_contact', 'do_not_disturb'] },
deliveryTime: Date,
distanceKm: Number,
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
      validator: val => val.length === 2,
      message: 'Coordinates must be [longitude, latitude]',
    },
  }
},
deliveryAddress: {
  street: { type: String, required: true },
  area: String,
  landmark: String,
  city: { type: String, required: true },
  state: String,
  pincode: { type: String},
  country: { type: String, default: 'India' }
},

// Agent assignment
allocationMethod: {
  type: String,
  enum: ['manual', 'one_by_one', 'nearest', 'fifo', 'broadcast'],
  default: 'one_by_one',
},
assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
agentCandidates: [agentCandidateSchema],
agentAssignedAt: Date,
agentAcceptedAt: Date,
agentAssignmentStatus: {
  type: String,
  enum: [
    "unassigned", "awaiting_agent_acceptance", "auto_accepted",
    "accepted_by_agent", "rejected_by_agent", "manually_assigned_by_admin", "reassigned_to_another",
    "assigned"
  ],
  default: "unassigned"
},
agentAssignmentTimestamp: Date,
agentDeliveryStatus: {
  type: String,
  enum: [
    'awaiting_start', 'start_journey_to_restaurant', 'reached_restaurant',
    'picked_up', 'out_for_delivery', 'reached_customer',
    'delivered', 'cancelled'
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
  reason: String
}],

// Order flow
orderStatus: {
  type: String,
  default: 'pending',
  enum: [
    'pending', 'pending_agent_acceptance', 'accepted_by_restaurant', 'rejected_by_restaurant',
    'preparing', 'ready', 'assigned_to_agent', 'picked_up', 'on_the_way',
    'in_progress', 'arrived', 'completed', 'delivered',
    'cancelled_by_customer', 'awaiting_agent_assignment', 'rejected_by_agent'
  ]
},
orderTime: { type: Date, default: Date.now },
scheduledTime: Date,
preparationTime: { type: Number, default: 20 },
preparationDelayReason: { type: String, default: "" },
orderPreparationDelay: Boolean,

// Reviews & cancellation
customerReview: String,
customerReviewImages: [String],
restaurantReview: String,
restaurantReviewImages: [String],
cancellationReason: String,
debtCancellation: Boolean,

// Guest
guestName: String,
guestPhone: String,
guestEmail: String,



// Promo Code Info
promoCode: {
  code: { type: String, default: null },
  discount: { type: Number, default: 0 },
  promoCodeId: { type: mongoose.Schema.Types.ObjectId, ref: "PromoCode", default: null }
},

// Loyalty Points
loyaltyPointsUsed: { type: Number, default: 0 },
loyaltyPointsValue: { type: Number, default: 0 }, // value in ₹ or $

// Offer Tracking (structured, optional if you already use offerId)
appliedOffers: [{
  offerId: { type: mongoose.Schema.Types.ObjectId, ref: "Offer" },
  title: String,
  discountType: String, // flat, percentage, combo, etc.
  discountAmount: Number,
  offerBreakdown: String // optional notes (e.g. combo info, bogo details)
}],








// Misc
instructions: { type: String, default: "" },
taxDetails: [{
  name: String,
  percentage: Number,
  amount: Number
}]
}, { timestamps: true });














orderSchema.plugin(mongoosePaginate);
orderSchema.index({ deliveryLocation: '2dsphere' });

module.exports = mongoose.model('Order', orderSchema);

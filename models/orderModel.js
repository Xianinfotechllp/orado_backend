const mongoose = require('mongoose');

const orderSchema = mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' },

  orderItems: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: Number,
    price: Number,
    name: String,
    totalPrice: Number, // price * quantity
  }],

  orderTime: { type: Date, default: Date.now },
  deliveryTime: Date,

  orderStatus: {
    type: String,
    default: 'pending',
    enum: [
      'pending', 'pending_agent_acceptance', 'accepted_by_restaurant', 'rejected_by_restaurant',
      'preparing', 'ready', 'assigned_to_agent', 'picked_up', 'in_progress',
      'arrived', 'completed', 'cancelled_by_customer', "awaiting_agent_assignment", "rejected_by_agent"
    ]
  },

  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: false,
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
  distanceKm: Number,   // from restaurant to delivery point

  paymentMethod: { type: String, enum: ['cash', 'online', 'wallet'] },
  paymentStatus: { type: String, enum: ['pending', 'completed', 'failed'] },

  deliveryMode: { type: String, enum: ['contact', 'no_contact', 'do_not_disturb'] },

  instructions: String, // special instructions
  orderPreparationDelay: Boolean,
  scheduledTime: Date, // for scheduled deliveries
  couponCode: String,

  customerReview: String,
  customerReviewImages: [String],
  restaurantReview: String,
  restaurantReviewImages: [String],

  cancellationReason: String,
  debtCancellation: Boolean,

  location: {
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
    },
    addressText: String, // readable delivery address
  },

  guestName: { type: String },
  guestPhone: { type: String },
  guestEmail: { type: String },

}, { timestamps: true });

orderSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Order', orderSchema);

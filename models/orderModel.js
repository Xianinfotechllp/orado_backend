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
    image: String, 

  }],

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

  assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },  

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

  paymentMethod: { type: String, enum: ['cash', 'online', 'wallet'] },
  paymentStatus: { type: String, enum: ['pending', 'completed', 'failed'] },

  deliveryMode: { type: String, enum: ['contact', 'no_contact', 'do_not_disturb'] },

  instructions: String,
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

orderSchema.index({ deliveryLocation: '2dsphere' });

module.exports = mongoose.model('Order', orderSchema);

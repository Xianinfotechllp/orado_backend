const mongoose = require('mongoose');

const orderSchema = mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' },
  orderItems: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: Number,
    price: Number,
    name: String,
  }],
  orderTime: { type: Date, default: Date.now },
  deliveryTime: Date,
  orderStatus: {
    type: String,
    default: 'pending',
    enum: [
      'pending',               // Order received, awaiting restaurant confirmation
      'accepted_by_restaurant',// Restaurant accepted the order
      'rejected_by_restaurant',// Restaurant rejected the order
      'preparing',             // Restaurant is preparing food
      'ready',                 // Food is ready for pickup
      'assigned_to_agent',     // Delivery agent assigned
      'picked_up',             // Agent has collected the order
      'on_the_way',            // Order is being delivered
      'arrived',               // Agent arrived at delivery location
      'delivered',             // Order successfully delivered
      'cancelled_by_customer', // Cancelled by customer
    ]
  },
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: false,
  },
  totalAmount: Number,
  deliveryCharge: Number,
  tipAmount: Number,
  paymentMethod: { type: String, enum: ['cash', 'online', 'wallet'] },
  paymentStatus: { type: String, enum: ['pending', 'completed', 'failed'] },
  customerReview: String,
  restaurantReview: String,
  cancellationReason: String,  // Store reason for cancellation
  debtCancellation: Boolean, // Flag for cancellation due to debt
  deliveryMode: { type: String, enum: ['contact', 'no_contact', 'do_not_disturb'] },
  
  // Location Information (Customer and Restaurant)
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      validate: {
        validator: function (val) {
          return val.length === 2;
        },
        message: 'Coordinates must be [longitude, latitude]',
      },
    },
  },

  surgeCharge: Number,
  orderPreparationDelay: Boolean, // Flag for order delay
  scheduledTime: Date, // For scheduled orders
  instructions: String, // Special instructions
  discountAmount: Number, // Applied discount
  couponCode: String,

  // Guest Order Info (For orders without login)
  guestName: { type: String },
  guestPhone: { type: String },
  guestEmail: { type: String },
});

module.exports = mongoose.model('Order', orderSchema);

const mongoose = require('mongoose');

const restaurantEarningsSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  totalOrderAmount: {
    type: Number,
    required: true
  },
  revenueShareAmount: {
    type: Number,
    required: true
  },
  revenueShareType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  revenueShareValue: {
    type: Number, // percentage value (like 10) or fixed amount (like ₹50)
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  remarks: {
    type: String,
    default: null
  },
  payoutStatus: {
    type: String,
    enum: ['pending', 'paid'],
    default: 'pending'
  },
  payoutDate: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('RestaurantEarning', restaurantEarningsSchema);

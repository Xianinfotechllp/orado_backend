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

  // 👌 Commission amount deducted from totalOrderAmount
  commissionAmount: {
    type: Number,
    required: true
  },

  commissionType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },

  commissionValue: {
    type: Number, // percentage (like 10) or fixed amount (like ₹50)
    required: true
  },

  // 💰 Net amount payable to restaurant after commission
  restaurantNetEarning: {
    type: Number,
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

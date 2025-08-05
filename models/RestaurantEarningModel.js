const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

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

  // 💳 Gross cart total before discount, tax, delivery fee
  cartTotal: {
    type: Number,
    required: false
  },

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
  // 💰 Final amount customer paid after discount, tax, delivery fee
  totalOrderAmount: {
    type: Number,
    required: true
  },

  // 👌 Commission deducted from cartTotal (or subtotal)
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

  // 💸 Net payout to restaurant after commission
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
  },
  earningStatus: {
    type: String,
    enum: ['pending', 'finalized'],
    default: 'pending'
  }

}, {
  timestamps: true
});

restaurantEarningsSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('RestaurantEarning', restaurantEarningsSchema);

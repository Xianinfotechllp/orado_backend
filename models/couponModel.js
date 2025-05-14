const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },
  maxDiscount: {
    type: Number,
    default: 0 // applicable for percentage type
  },
  minOrderAmount: {
    type: Number,
    default: 0
  },
  usageLimit: {
    type: Number,
    default: 1 // how many times a user can use this coupon
  },
  globalUsageLimit: {
    type: Number,
    default: 0 // 0 = unlimited usage globally
  },
  usersUsed: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  usedCount: {
    type: Number,
    default: 0
  },
  validFrom: {
    type: Date,
    required: true
  },
  validTill: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  targetUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  targetRestaurants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant'
  }],
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);

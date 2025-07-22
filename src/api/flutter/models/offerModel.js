const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },

  description: {
    type: String,
    default: '',
  },

  type: {
    type: String,
    enum: ['flat', 'percentage'],
    required: true,
  },

  discountValue: {
    type: Number,
    required: true,
  },

  maxDiscount: {
    type: Number, // applicable if type is 'percentage'
  },

  minOrderValue: {
    type: Number,
    required: true,
  },

  applicableRestaurants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
    },
  ],

  validFrom: {
    type: Date,
    required: true,
  },

  validTill: {
    type: Date,
    required: true,
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  createdBy: {
    type: String,
    enum: ['admin', 'restaurant'],
    required: true,
  },

  createdByRestaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    default: null, // if createdBy is 'restaurant'
  },

  usageLimitPerUser: {
    type: Number,
    default: 1,
  },

  totalUsageLimit: {
    type: Number, // overall limit across all users
  },

  currentUsageCount: {
    type: Number,
    default: 0,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Offer', offerSchema);

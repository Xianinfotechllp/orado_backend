// models/FoodItem.js

const mongoose = require('mongoose');

const product = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  images: {
    type: [String],
    default: []
  },
  active: {
    type: Boolean,
    default: true
  },
  foodType: {
    type: String,
    enum: ['veg', 'non-veg'],
    required: true
  },
  addOns: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AddOn'
  }],
  specialOffer: {
    discount: {
      type: Number,
      default: 0
    },
    startDate: Date,
    endDate: Date
  },
  rating: { 
    type: Number,
    default: 0
  },
   attributes: [
    {
      name: { type: String, required: true },  
      price: { type: Number, required: true },
      stock: { type: Number, default: 0 },
      calories: Number,
      isAvailable: { type: Boolean, default: true },
      description: { type: String, default: null }
    }
  ],
  unit: {
    type: String,
    default: 'piece'
  },
  stock: {
    type: Number,
    default: 0
  },
  reorderLevel: {
    type: Number,
    default: 0
  },
  revenueShare: {
  type: {
    type: String,
    enum: ['percentage', 'fixed'],

    default: 'percentage'
  },
  value: {
    type: Number,
 
    default: 10 // default 10% if percentage type
  }
}
}, {
  timestamps: true
});

module.exports = mongoose.model('Product', product);

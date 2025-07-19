const mongoose = require("mongoose");

const taxAndChargeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  value: {
    type: Number,
    required: true,
  },

  type: {
    type: String,
    enum: ['Fixed', 'Percentage', 'Variable'],
    required: true,
  },

  applicableOn: {   
    type: String,
    enum: [
      'All Orders',
      'Food Items',
      'Groceries',
      'Meat',
      'Delivery Fee',
      'Packing Charge'
    ],
    required: true,
  },

  category: {
    type: String,
    enum: ['Tax', 'PackingCharge', 'AdditionalCharge'],
    required: true,
  },

  level: {
    type: String,
    enum: ['Marketplace', 'Merchant'],
    required: true,
  },

  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    default: null,
  },

  status: {
    type: Boolean,
    default: true,
  },

}, {
  timestamps: true
});

module.exports = mongoose.model("TaxAndCharge", taxAndChargeSchema);

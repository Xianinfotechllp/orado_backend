const mongoose = require('mongoose');

const merchantCommissionSettingSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant', // or 'User' if you store all merchants under a common model
    required: false // null means global default
  },

  storeType: {
    type: String,
    enum: ['restaurant', 'grocery', 'meat'], // extend as needed
    required: false // optional if you want to apply by type
  },

  commissionType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },

  commissionValue: {
    type: Number,
    required: true
  },

  isDefault: {
    type: Boolean,
    default: false
  },

  commissionBase: {
    type: String,
    enum: ["subtotal", "subtotal+tax", "finalAmount"],
    default: "subtotal"
  },

}, { timestamps: true });

module.exports = mongoose.model('MerchantCommissionSetting', merchantCommissionSettingSchema);

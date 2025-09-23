const mongoose = require('mongoose');

const merchantCommissionSettingSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: false
  },

  storeType: {
    type: String,
    enum: ['restaurant', 'grocery', 'meat', 'pharmacy'],
    required: false
  },

  commissionType: {
    type: String,
    enum: ['percentage', 'fixed', 'costPrice'],
    required: true
  },

  commissionValue: {
    type: Number,
    required: function() {
      // Only required if commissionType is not 'costPrice'
      return this.commissionType !== 'costPrice';
    }
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

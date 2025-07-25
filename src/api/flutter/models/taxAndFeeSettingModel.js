const mongoose = require("mongoose")


  const taxSchema = new mongoose.Schema({
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true
    },
    name: {
      type: String,
      required: true
    },
    percentage: {
      type: Number,
      required: true
    },
    applicableFor: {
      type: String,
      enum: ['food', 'beverages', 'meat', 'grocery', 'deliveryFee', 'commission', 'agent'],
      required: true
    },
    active: {
      type: Boolean,
      default: true
    }
  }, { _id: false });

  const taxAndFeeSettingSchema = new mongoose.Schema({

    taxes: {
      type: [taxSchema],
      default: []
    },

    // Delivery Fee Settings
    deliveryFeeType: {
      type: String,
      enum: ['Fixed', 'Per KM', 'Per Order Type'],
      default: 'Fixed'
    },

    // Common for all fee types
    baseDeliveryFee: {
      type: Number,
      default: 40
    },

    // Per KM Fee Settings
    baseDistanceKm: {
      type: Number,
      default: 2 // in km
    },
    perKmFeeBeyondBase: {
      type: Number,
      default: 5 // ₹ per km beyond base distance
    },

    orderTypeDeliveryFees: {
      type: Map,
      of: Number,
      default: {}
    },

    // Surge Pricing
    enableSurgePricing: {
      type: Boolean,
      default: false
    },
    defaultSurgeFee: {
      type: Number,
      default: 0
    },

    // Commission Settings
    commissionType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage'
    },
    commissionValue: {
      type: Number,
      default: 20
    },

  }, {
    timestamps: true
  });


  module.exports = mongoose.model('TaxAndFeeSetting', taxAndFeeSettingSchema);

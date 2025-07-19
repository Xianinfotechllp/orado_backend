const mongoose = require("mongoose");

const citySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 100
    },
    description: {
      type: String,
      default: "",
      maxlength: 500
    },
    geofences: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Geofence"
      }
    ],

    // ⚙️ Normal Orders Settings
    // isNormalOrderActive: {
    //   type: Boolean,
    //   default: false
    // },
    // normalOrderChargeCalculation: {
    //   type: Boolean,
    //   default: false
    // },
    // normalOrdersChargeType: {
    //   type: String,
    //   enum: ["Fixed", "Dynamic"],
    //   default: "Fixed"
    // },
    // fixedDeliveryChargesNormalOrders: {
    //   type: Number,
    //   default: 0
    // },
    // dynamicChargesTemplateNormalOrders: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Template",
    //   default: null
    // },
    // dynamicChargesTemplateScheduleOrder: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Template",
    //   default: null
    // },
    // earningTemplateNormalOrder: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Template",
    //   default: null
    // },

    // // ⚙️ Custom Orders Settings
    // isCustomOrderActive: {
    //   type: Boolean,
    //   default: false
    // },
    // customOrderChargeCalculation: {
    //   type: Boolean,
    //   default: false
    // },
    // cityChargeType: {
    //   type: String,
    //   enum: ["Fixed", "Dynamic"],
    //   default: "Fixed"
    // },
    // fixedDeliveryChargesCustomOrders: {
    //   type: Number,
    //   default: 0
    // },

    // ✅ City-Specific Delivery Fee Settings
    cityDeliveryFeeSetting: {
      isCustomFeeEnabled: { type: Boolean, default: false },
      deliveryFeeType: {
        type: String,
        enum: ['Fixed', 'Per KM'],
        default: 'Fixed'
      },
      baseDeliveryFee: {
        type: Number,
        default: 40
      },
      baseDistanceKm: {
        type: Number,
        default: 2
      },
      perKmFeeBeyondBase: {
        type: Number,
        default: 5
      }
    },

    // Status
    status: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("City", citySchema);

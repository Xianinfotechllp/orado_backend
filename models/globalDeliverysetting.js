const mongoose = require("mongoose");

const globalDeliverySettingsSchema = new mongoose.Schema({
  deliveryModes: {
    virtualMeet: { type: Boolean, default: false },
    homeDelivery: { type: Boolean, default: true },
    pickAndDrop: { type: Boolean, default: false }
  },

  defaultDeliveryMode: {
    type: String,
    enum: ["virtualMeet", "homeDelivery", "pickAndDrop"],
    default: "homeDelivery"
  },

  deliveryTime: { type: Number, default: 30 }, // in minutes

  deliveryFlow: {
    type: String,
    enum: ["restaurantToCustomer", "customerToRestaurant"],
    default: "restaurantToCustomer"
  },

  distanceWiseDelivery: { type: Boolean, default: false },

  onDemandTemplate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Template",
    default: null
  },

  scheduledTemplate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Template",
    default: null
  },
  freeDelivery: { type: Boolean, default: false },
  freeDeliveryAmount: { type: Number, default: 0 },

  merchantDeliveryManagement: { type: Boolean, default: false },
  externalDeliveryCharge: { type: Boolean, default: false },
  trackingLinkConfig: { type: Boolean, default: false },

  etaEnabled: { type: Boolean, default: false },
  mapprApiKey: { type: String, default: "" },

  staticAddresses: { type: Boolean, default: false },

  deliveryCharge: { type: Number, default: 0 },

  merchantWiseDelivery: { type: Boolean, default: false },

  tipSettings: {
    tipEnabled: { type: Boolean, default: false },
    minTipPercent: { type: Number, default: 0 },
    tipType: { type: String, enum: ["fixed", "percentage", ""], default: "" },
    allowManualTip: { type: Boolean, default: false },
    tipOptions: { type: Boolean, default: false }
  }

}, { timestamps: true });

module.exports = mongoose.model("GlobalDeliverySettings", globalDeliverySettingsSchema);

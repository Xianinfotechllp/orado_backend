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
    chargeType: {
      type: String,
      enum: ["Fixed Price", "Dynamic"],
      default: "Fixed Price"
    },
    status: {
      type: Boolean,
      default: true
    },
    isNormalOrderActive: {
      type: Boolean,
      default: false
    },
    normalOrderChargeCalculation: {
      type: Boolean,
      default: false
    },
    isCustomOrderActive: {
      type: Boolean,
      default: false
    },
    customOrderChargeCalculation: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("City", citySchema);

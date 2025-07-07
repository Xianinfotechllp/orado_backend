const mongoose = require("mongoose");

const geofenceSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["delivery_zone", "surge_area", "restricted_area"],
      required: true
    },
    regionName: {
      type: String,
      required: true,
      trim: true
    },
    regionDescription: {
      type: String,
      default: ""
    },
    geometry: {
      type: {
        type: String,
        enum: ["Polygon", "Circle"],
        required: true
      },
      coordinates: {
        type: [[[Number]]],
        required: true
      },
      radius: {
        type: Number
      }
    },
    active: {
      type: Boolean,
      default: true
    },
    lastUpdatedBy: {
      type: String
    }
  },
  { timestamps: true }
);

// ✅ Correct 2dsphere index on coordinates
geofenceSchema.index({ geometry: "2dsphere" });

module.exports = mongoose.model("Geofence", geofenceSchema);

const mongoose = require("mongoose");

const citySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,  // prevent duplicate city names
      trim: true,
    },

    type: {
      type: String,
      enum: ["Polygon", "Circle"],
      required: true,
    },

    // For Polygon cities
    area: {
      type: {
        type: String,
        enum: ["Polygon"],
      },
      coordinates: {
        type: [[[Number]]], // array of linear rings of [lng, lat]
      },
    },

    // For Circle cities
    center: {
      type: [Number], // [lng, lat]
    },

    radius: {
      type: Number, // in meters
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

// Geo indexes for efficient spatial queries
citySchema.index({ area: "2dsphere" });
citySchema.index({ center: "2dsphere" });

module.exports = mongoose.model("City", citySchema);

const mongoose = require("mongoose");

const serviceAreaSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true
  },

  type: {
    type: String,
    enum: ["Polygon", "Circle"],
    required: true
  },

  // Polygon-based area (GeoJSON)
  area: {
    type: {
      type: String,
      enum: ["Polygon"]
    },
    coordinates: {
      type: [[[Number]]]  // array of linear rings [ [lng, lat], ... ]
    }
  },

  // Circle-based area
  center: {
    type: [Number]  // [lng, lat]
  },
  radius: {
    type: Number   // in meters
  }

}, { timestamps: true });

// Geo indexes
serviceAreaSchema.index({ area: "2dsphere" });
serviceAreaSchema.index({ center: "2dsphere" });

module.exports = mongoose.model("ServiceArea", serviceAreaSchema);

const mongoose = require("mongoose");

const serviceAreaSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true
  },
  area: {
    type: {
      type: String,
      enum: ["Polygon"],
      required: true,
      default: "Polygon"
    },
    coordinates: {
      type: [[[Number]]], // 3D array: [ [ [lng, lat], [lng, lat], ... ] ]
      required: true
    }
  }
}, { timestamps: true });

// ✅ Geo index on area field
serviceAreaSchema.index({ area: "2dsphere" });

module.exports = mongoose.model("ServiceArea", serviceAreaSchema);

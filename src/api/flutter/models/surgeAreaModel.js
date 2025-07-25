const mongoose = require("mongoose");

const surgeAreaSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  surgeReason: {
    type: String
   
  },

  type: {
    type: String,
    enum: ["Polygon", "Circle"],
    required: true
  },

  // 📌 For Polygon areas
  area: {
    type: {
      type: String,
      enum: ["Polygon"]
    },
    coordinates: {
      type: [[[Number]]]  // 3D array: array of linear rings of [lng, lat] points
    }
  },

  // 📌 For Circle areas
  center: {
    type: [Number] // [lng, lat]
  },

  radius: {
    type: Number // in meters
  },

  // 📌 Surge type: 'fixed' or 'percentage'
  surgeType: {
    type: String,
    enum: ['fixed', 'percentage'],
    required: true
  },

  // 📌 Surge value: either ₹ amount or % depending on surgeType
  surgeValue: {
    type: Number,
    required: true
  },

  startTime: {
    type: Date,
    required: true
  },

  endTime: {
    type: Date,
    required: true
  },

  isActive: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true
});

// 📌 Index for Geo queries
surgeAreaSchema.index({ area: "2dsphere" });
surgeAreaSchema.index({ center: "2dsphere" });

module.exports = mongoose.model("SurgeArea", surgeAreaSchema);

import mongoose from "mongoose";

const citySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  cityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "City",
    required: true, // though having cityId in a City model is a bit circular — you might mean parentCityId or regionId
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
      type: [[[Number]]],
    },
  },

  // For Circle cities
  center: {
    type: [Number],
  },

  radius: {
    type: Number,
  },

  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },

}, {
  timestamps: true,
});

// Geo indexes
citySchema.index({ area: "2dsphere" });
citySchema.index({ center: "2dsphere" });

export default mongoose.model("City", citySchema);

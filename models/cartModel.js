const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant", // Reference to Restaurant model
      required: true,
    },
    active: { type: Boolean, default: true }, // Control category visibility
    autoOnOff: { type: Boolean, default: true }, // Auto toggle based on restaurant hours
    description: { type: String, required: true }, // Category description
    images: [String], // Array of image URLs for the category
  },
  { timestamps: true }
);


categorySchema.index({ restaurantId: 1 });
categorySchema.index({ active: 1 });

module.exports = mongoose.model("Category", categorySchema);

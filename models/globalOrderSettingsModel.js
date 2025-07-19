const mongoose = require("mongoose");

const globalOrderSettingsSchema = new mongoose.Schema({
  acceptRejectOrder: { type: Boolean, default: false },
  editOrder: { type: Boolean, default: false },
  autoPrint: { type: Boolean, default: false },
  orderStatusConfig: { type: Boolean, default: false },
  emailTaxLabel: { type: Boolean, default: false },
  taskTagging: { type: Boolean, default: false },
  ratingsReviews: { type: Boolean, default: false },

  acceptanceTime: { type: Number, default: 0 },
  scheduleAdjustThreshold: { type: Number, default: 0 },
  bufferTime: { type: Number, default: 0 },

  taxLabels: {
    type: [String],
    default: []
  },
  taskTags: {
    type: [String],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model("GlobalOrderSettings", globalOrderSettingsSchema);

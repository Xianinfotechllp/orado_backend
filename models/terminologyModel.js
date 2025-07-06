const mongoose = require("mongoose");

const terminologySchema = new mongoose.Schema({
  language: {
    type: String,
    required: true,
    unique: true,
  },

  terms: {
    type: Map,
    of: String,
    required: true,
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    default: null,
  },
}, { timestamps: true });  // ✅ Clean timestamp handling

module.exports = mongoose.model("Terminology", terminologySchema);

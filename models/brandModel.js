const mongoose = require("mongoose");

const BrandSchema = new mongoose.Schema({
  brandName: { type: String, required: true },
  // optionally other fields
}, { timestamps: true });

module.exports = mongoose.model("Brand", BrandSchema);

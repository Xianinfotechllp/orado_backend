const mongoose = require("mongoose");

const discountSchema = new mongoose.Schema({
  discountType: {
    type: String,
    enum: ["Percentage", "Flat"],
    required: true
  },
  applicationLevel: {
    type: String,
    enum: ["Restaurant", "Product"],
    required: true
  },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product"  // only required if applicationLevel is 'Product'
  },
  discountValue: {
    type: Number,
    required: true
  },
  maxDiscountValue: {
    type: Number
  },
  description: {
    type: String,
    maxlength: 150
  },
  validFrom: {
    type: Date
  },
  validTo: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Discount", discountSchema);

const mongoose = require("mongoose");

const discountSchema = new mongoose.Schema({


    
  discountType: {
    type: String,
    enum: ["Percentage", "Flat"],
    required: true
  },

   name: {                      // 👈 added this
    type: String,
    required: true,
    trim: true
  },
  applicationLevel: {
    type: String,
    enum: ["Restaurant", "Product"],
    required: true
  },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: function() {
      return this.applicationLevel === "Restaurant" || this.applicationLevel === "Product";
    }
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: function() {
      return this.applicationLevel === "Product";
    }
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
    type: Date,
    required: true
  },
  validTo: {
    type: Date,
    required: true
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

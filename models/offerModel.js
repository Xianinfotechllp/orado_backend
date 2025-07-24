const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },

  description: {
    type: String,
    default: "",
  },

  type: {
    type: String,
    enum: ["flat", "percentage", "combo", "bogo"], // Added combo and bogo
    required: true,
  },

  discountValue: {
    type: Number,
    required: true,
  },

  discountValue: {
  type: Number,
  required: function () {
    return this.type === "flat" || this.type === "percentage";
  },
},


  maxDiscount: {
    type: Number, // applicable if type is 'percentage'
  },

  minOrderValue: {
    type: Number,
    required: true,
  },

  applicableRestaurants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
    },
  ],

  validFrom: {
    type: Date,
    required: true,
  },

  validTill: {
    type: Date,
    required: true,
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  createdBy: {
    type: String,
    enum: ["admin", "restaurant"],
    required: true,
  },

  createdByRestaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    default: null, // if createdBy is 'restaurant'
  },

  usageLimitPerUser: {
    type: Number,
    default: 1,
  },

  totalUsageLimit: {
    type: Number, // overall limit across all users
  },

  currentUsageCount: {
    type: Number,
    default: 0,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  applicableProducts: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
  ],
  applicableLevel: {
    type: String,
    enum: ["Restaurant", "Product"],
    required: true,
  },
  // Combo offer: list of products and combo price
  comboProducts: [
    {
      name: String,
      products: [
        {
          product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
          quantity: { type: Number, default: 1 },
        },
      ],
      comboPrice: Number,
    },
  ],
  // BOGO offer: buy one get one details
  bogoDetails: {
    buyProduct: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    getProduct: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    buyQty: { type: Number, default: 1 },
    getQty: { type: Number, default: 1 },
  },
});

module.exports = mongoose.model("Offer", offerSchema);

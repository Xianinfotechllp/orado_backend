const mongoose = require("mongoose");

const taxSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      min: [0, "Tax amount must be a positive number"],
    },

    type: {
      type: String,
      enum: ["Percentage", "Fixed"],
      required: true,
    },

    appliedOn: {
      type: String,
      enum: ["product", "delivery", "marketplace", "cartValue", "subscription"],
      required: true,
    },

    taxType: {
      type: String,
      enum: ["Marketplace", "Restaurant", "AdditionalCharge", "Subscription"],
      required: true,
    },  

    restaurants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Restaurant",
      },
    ],

    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
    }
,
    cities: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "City",
      },
    ],

    status: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// 📌 Pre-save Hook — Normalize name
taxSchema.pre("save", function (next) {
  this.name = this.name.trim();
  next();
});

// 📌 Static Method — Check for duplicate tax by name + appliedOn + taxType
taxSchema.statics.isDuplicateTax = async function (name, appliedOn, taxType) {
  const existing = await this.findOne({
    name: new RegExp(`^${name}$`, "i"),
    appliedOn,
    taxType,
  });
  return !!existing;
};

module.exports = mongoose.model("Tax", taxSchema);
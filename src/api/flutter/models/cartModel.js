const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    unique: true
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true
  },
  products: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
      },
      name: String,
      description: String,  // 👈 added
      images: [String],      // 👈 added
      foodType: {
        type: String,
        enum: ['veg', 'non-veg']
      },                     // 👈 added
      price: Number,
      quantity: Number,
      total: Number
    }
  ],
  totalPrice: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model("Cart", cartSchema);

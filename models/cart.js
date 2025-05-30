const CartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true  // enforce one cart per user
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  products: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      name: String,
      price: Number,
      quantity: Number,
      total: Number
    }
  ],
  totalPrice: Number
});

// 👉 Make sure unique index is sparse
CartSchema.index({ userId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Cart', CartSchema);

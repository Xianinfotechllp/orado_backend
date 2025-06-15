const mongoose = require('mongoose');

const productReviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true,
  },
  comment: {
    type: String,
    maxlength: 1000,
  },
  images: [String],

  // reply details
  reply: {
    type: String,
    maxlength: 1000,
  },
  repliedBy: {
    type: String,
    enum: ['admin', 'merchant'],
  },
  repliedAt: {
    type: Date,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ✅ Correct model export
module.exports = mongoose.model("ProductReview", productReviewSchema);

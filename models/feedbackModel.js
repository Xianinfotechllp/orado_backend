const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
  },
  targetType: {
    type: String,
    enum: ['restaurant', 'agent', 'order'],
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
  images: [
    {
      type: String, // Image URL or Cloudinary public ID
    }
  ],
  reply: {
    type: String, // Reply message text
    maxlength: 1000,
  },
  repliedBy: {
    type: String, // Optional — e.g., 'admin', 'restaurant', 'agent'
    enum: ['admin', 'restaurant', 'agent'],
  },
  repliedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Feedback', feedbackSchema);

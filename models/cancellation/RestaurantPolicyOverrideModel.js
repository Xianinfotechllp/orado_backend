const mongoose = require('mongoose');

const restaurantPolicyOverrideSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true,
    unique: true
  },
  policy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CancellationPolicy',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('RestaurantPolicyOverride', restaurantPolicyOverrideSchema);

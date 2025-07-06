const mongoose = require('mongoose');

const cancellationSettingSchema = new mongoose.Schema({
  allowCustomerCancellations: {
    type: Boolean,
    default: true
  },
  allowRestaurantOverride: {
    type: Boolean,
    default: false
  },
  allowCustomReasons: {
    type: Boolean,
    default: true
  },
  allowPredefinedReasons: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Auto-update `updatedAt` on every save
cancellationSettingSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('CancellationSetting', cancellationSettingSchema);

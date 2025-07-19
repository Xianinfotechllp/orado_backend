const mongoose = require('mongoose');

const platformSettingSchema = new mongoose.Schema({
  commission: {
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage',
    },
    value: {
      type: Number,
      default: 15,
    },
  },
}, { timestamps: true });

module.exports = mongoose.model('PlatformSetting', platformSettingSchema);
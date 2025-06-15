const mongoose = require('mongoose');



const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
    // Not required directly — conditional validation handled below
  },

  sendToAll: {
    type: Boolean,
    default: false
  },

  title: {
    type: String,
    required: true
  },

  body: {
    type: String,
    required: true
  },

  type: {
    type: String,
    enum: ['orderUpdates', 'promotions', 'walletCredits', 'newFeatures', 'serviceAlerts'],
    required: true
  },

  read: {
    type: Boolean,
    default: false
  },

  delivered: {
    type: Boolean,
    default: false
  },

  sentAt: {
    type: Date
  },

}, {
  timestamps: true
});

// 📌 Custom validation to enforce userId presence if sendToAll is false
NotificationSchema.pre('validate', function (next) {
  if (!this.sendToAll && !this.userId) {
    return next(new Error('userId is required when sendToAll is false.'));
  }
  next();
});

module.exports = mongoose.model('Notification', NotificationSchema);


const NotificationPreferenceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
  orderUpdates: { type: Boolean, default: true },
  promotions: { type: Boolean, default: true },
  walletCredits: { type: Boolean, default: true },
  newFeatures: { type: Boolean, default: true },
  serviceAlerts: { type: Boolean, default: true },
});

const Notification = mongoose.model('Notification', NotificationSchema);
const NotificationPreference = mongoose.model('NotificationPreference', NotificationPreferenceSchema);

module.exports = { Notification, NotificationPreference };

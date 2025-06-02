const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: String,
  body: String,
  type: {
    type: String,
    enum: ['orderUpdates', 'promotions', 'walletCredits', 'newFeatures', 'serviceAlerts'],
    required: true,
  },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

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

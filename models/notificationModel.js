const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
    enum: ['orderUpdates', 'promotions', 'walletCredits', 'newFeatures', 'serviceAlerts', "info"],
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
    type: Date // when it was actually sent
  },

  // ✅ New fields for scheduling
  schedule: {
    type: Date, // when it should be sent
    default: null
  },

  recurring: {
    enabled: { type: Boolean, default: false },
    interval: { type: String, enum: ['daily', 'weekly', 'monthly'], default: null }, // how often it should repeat
    endDate: { type: Date, default: null } // optional end date for recurring
  },

}, {
  timestamps: true
});

// Custom validation for userId when sendToAll is false
NotificationSchema.pre('validate', function (next) {
  if (!this.sendToAll && !this.userId) {
    return next(new Error('userId is required when sendToAll is false.'));
  }
  next();
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

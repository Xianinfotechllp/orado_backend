const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },

  channelType: {
    type: String,
    enum: ['web_push', 'support', 'promotional', 'popup'],
    required: true,
  },

  messageTitle: { type: String, required: true },
  messageBody: { type: String, required: true },

  segment: { type: String, default: 'all' },

  campaignType: {
    type: String,
    enum: ['now', 'later', 'recurring'],
    required: true,
  },

  scheduledTime: { type: Date },
  recurringInterval: { type: String },

  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sent', 'cancelled'],
    default: 'draft',
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
  },

  sentAt: { type: Date },

  // 📌 New fields for engagement tracking
  sentTo: { type: Number, default: 0 },                         // total recipients count
  readUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],  // list of users who read it
  replyCount: { type: Number, default: 0 },                     // total reply count

}, { timestamps: true });

module.exports = mongoose.model('Campaign', CampaignSchema);

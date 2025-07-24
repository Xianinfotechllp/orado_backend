const mongoose = require('mongoose');

const agentNotificationSchema = new mongoose.Schema({
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },

  title: { type: String, required: true },
  body: { type: String, required: true },
  data: { type: Object, default: {} },

  sentAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
  readAt: { type: Date, default: null },
});

module.exports = mongoose.model('AgentNotification', agentNotificationSchema);

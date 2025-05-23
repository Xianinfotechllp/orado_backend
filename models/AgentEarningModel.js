const mongoose = require('mongoose');const agentEarningSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['delivery_fee', 'incentive', 'penalty', 'other'],
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  remarks: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AgentEarning', agentEarningSchema);
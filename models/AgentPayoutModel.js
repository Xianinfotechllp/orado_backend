const mongoose = require('mongoose');
const { Schema } = mongoose;

const AgentPayoutSchema = new Schema({
  agentId: {
    type: Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
    index: true,
  },

  periodType: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    required: true,
  },

  periodIdentifier: {
    type: String, // e.g., "2025-09-29" or "2025-w39" or "2025-m9"
    required: true,
  },

  totalEarnings: {
    type: Number,
    required: true,
    min: 0,
  },

  totalTips: {
    type: Number,
    required: true,
    default: 0,
  },

  totalSurge: {
    type: Number,
    required: true,
    default: 0,
  },

  totalIncentives: {
    type: Number,
    required: true,
    min: 0,
  },

  totalPayout: {
    type: Number,
    required: true,
    min: 0,
  },

  payoutStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid'],
    default: 'pending',
  },

  paidAmount: {
    type: Number,
    default: 0,
    min: 0,
  },

  payoutDate: {
    type: Date,
  },

}, {
  timestamps: true,
});

module.exports = mongoose.model('AgentPayout', AgentPayoutSchema);

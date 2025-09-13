const mongoose = require('mongoose');
const { Schema } = mongoose;

  const AgentIncentiveEarningSchema = new Schema({
    agentId: {
    type: Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
    index: true,
  },

  planId: {
    type: Schema.Types.ObjectId,
    ref: 'IncentivePlan',
    required: true,
    index: true,
  },

  periodType: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    required: true,
  },

  periodIdentifier: {
    type: String, // e.g., "2025-09-10" or "2025-w37" or "2025-m9"
    required: true,
  },

  incentiveAmount: {
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

module.exports = mongoose.model('AgentIncentiveEarning', AgentIncentiveEarningSchema);

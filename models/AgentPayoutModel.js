const mongoose = require('mongoose');
const { Schema } = mongoose;

const AgentPayoutSchema = new Schema({
  agentId: {
    type: Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
    index: true,
  },

  // Orders included in this payout
  earningIds: [{
    type: Schema.Types.ObjectId,
    ref: 'AgentEarning',
  }],

  // Incentives included in this payout
  incentiveIds: [{
    type: Schema.Types.ObjectId,
    ref: 'AgentIncentiveEarning',
  }],

  // Consolidated total (earnings + incentives)
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
  },

  // How much was actually paid (for partial payouts)
  paidAmount: {
    type: Number,
    default: 0,
    min: 0,
  },

  payoutStatus: {
    type: String,
    enum: ['pending', 'processing', 'paid'],
    default: 'pending',
  },

  payoutDate: {
    type: Date,
  },

  // Payment transaction reference (UPI, bank ref, etc.)
  transactionId: {
    type: String,
  },

  // Payment method used
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'upi', 'wallet', 'cash'],
  },

  // Optional: Admin/user who processed payout
  processedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Admin',
  },

}, {
  timestamps: true,
});

module.exports = mongoose.model('AgentPayout', AgentPayoutSchema);

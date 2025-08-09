const mongoose = require('mongoose');

const AgentEarningSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
    index: true,
  },

  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true,
  },

  baseDeliveryFee: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    comment: "Base fee for delivery (e.g. for baseKm)",
  },

  distanceBeyondBaseKm: {
    type: Number,
    default: 0,
    min: 0,
    comment: "Distance beyond baseKm charged extra",
  },

  extraDistanceFee: {
    type: Number,
    default: 0,
    min: 0,
    comment: "Fee for extra distance beyond baseKm",
  },

  surgeAmount: {
    type: Number,
    default: 0,
    min: 0,
    comment: "Surge pricing amount (if any)",
  },

  tipAmount: {
    type: Number,
    default: 0,
    min: 0,
    comment: "Tip given by customer",
  },

  incentiveAmount: {
    type: Number,
    default: 0,
    min: 0,
    comment: "Incentive/bonus for this order (peak hour, rain, etc.)",
  },

  totalEarning: {
    type: Number,
    required: true,
    min: 0,
    comment: "Sum of all components",
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

  paymentDate: {
    type: Date,
  },
}, {
  timestamps: true, // adds createdAt and updatedAt fields automatically
});

AgentEarningSchema.pre('save', function (next) {
  this.totalEarning =
    this.baseDeliveryFee +
    this.extraDistanceFee +
    this.surgeAmount +
    this.tipAmount +
    this.incentiveAmount;
  next();
});

module.exports = mongoose.model('AgentEarning', AgentEarningSchema);

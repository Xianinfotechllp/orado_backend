const mongoose = require('mongoose');
const { Schema } = mongoose;

// ==============================================
// 1. SIMPLIFIED INCENTIVE CONDITION SCHEMA
// ==============================================
const IncentiveConditionSchema = new Schema({
  conditionType: {
    type: String,
    enum: ['earnings', 'deliveries'], // Removed 'combined'
    required: true
  },
  threshold: {
    type: Number,
    required: true,
    min: 0
  },
  incentiveAmount: {
    type: Number,
    required: true,
    min: 0
  }
});

// ==============================================
// 2. INCENTIVE PLAN SCHEMA (Simplified)
// ==============================================
const IncentivePlanSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  period: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    required: true
  },
  conditions: [IncentiveConditionSchema], // Now holds individual conditions
  validFrom: {
    type: Date,
    default: Date.now
  },
  validTo: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  totalAgentsClaimed: {
    type: Number,
    default: 0
  },
  totalPayout: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// ==============================================
// 3. AGENT PROGRESS SCHEMA (With Evaluation Helper)
// ==============================================
const AgentIncentiveProgressSchema = new Schema({
  agentId: {
    type: Schema.Types.ObjectId,
    ref: 'Agent',
    required: true
  },
  planId: {
    type: Schema.Types.ObjectId,
    ref: 'IncentivePlan',
    required: true
  },
  periodType: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    required: true
  },
  periodIdentifier: {
    type: String,
    required: true
  },
  currentEarnings: {
    type: Number,
    default: 0
  },
  currentDeliveries: {
    type: Number,
    default: 0
  },
  isQualified: {
    type: Boolean,
    default: false
  },
  incentiveAwarded: {
    type: Number,
    default: 0
  },
  paidOut: {
    type: Boolean,
    default: false
  },
  payoutDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Auto-generate period identifier
AgentIncentiveProgressSchema.pre('save', function(next) {
  const now = new Date();
  if (this.periodType === 'weekly') {
    this.periodIdentifier = `${now.getFullYear()}-w${getWeekNumber(now)}`;
  } else if (this.periodType === 'monthly') {
    this.periodIdentifier = `${now.getFullYear()}-m${now.getMonth() + 1}`;
  } else {
    this.periodIdentifier = now.toISOString().split('T')[0];
  }
  next();
});

// Add evaluation method
AgentIncentiveProgressSchema.methods.evaluateConditions = function(planConditions) {
  let totalIncentive = 0;
  let allConditionsMet = true;
  
  // Check each condition individually
  for (const condition of planConditions) {
    const meetsCondition = condition.conditionType === 'earnings' 
      ? this.currentEarnings >= condition.threshold
      : this.currentDeliveries >= condition.threshold;
    
    if (meetsCondition) {
      totalIncentive += condition.incentiveAmount;
    } else {
      allConditionsMet = false;
    }
  }
  
  // Update progress
  this.isQualified = allConditionsMet;
  this.incentiveAwarded = totalIncentive;
  
  return {
    qualifies: allConditionsMet,
    totalIncentive
  };
};

// Helper function to get week number
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

// Create models
const IncentivePlan = mongoose.model('IncentivePlan', IncentivePlanSchema);

module.exports =  IncentivePlan
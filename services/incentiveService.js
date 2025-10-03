const AgentIncentiveEarning = require('../models/AgentIncentiveEarningModel');
const IncentivePlan = require('../models/IncentiveRuleModel');
const AgentEarning = require('../models/AgentEarningModel'); // Each order's earning

// Correct export and async function
exports.createAgentIncentive = async ({ agentId }) => {
  const now = new Date();
  console.log('🔹 Running createAgentIncentive for agentId:', agentId, 'at', now);

  try {
    // 1️⃣ Get all active incentive plans
    const activePlans = await IncentivePlan.find({
      isActive: true,
      validFrom: { $lte: now },
      $or: [{ validTo: null }, { validTo: { $gte: now } }]
    });

    console.log('🔹 Found active incentive plans:', activePlans.length);

    for (const plan of activePlans) {
      console.log('➡ Processing plan:', plan.name, 'Period:', plan.period);

      // Determine period identifier and dates
      const periodIdentifier = getPeriodIdentifier(plan.period, now);
      const startOfPeriod = getPeriodStartDate(plan.period, now);
      const endOfPeriod = getPeriodEndDate(plan.period, now);
      console.log('   Period Identifier:', periodIdentifier, 'Start:', startOfPeriod, 'End:', endOfPeriod);

      // 2️⃣ Calculate total earnings and completed deliveries for this period
      const earnings = await AgentEarning.find({
        agentId,
        createdAt: { $gte: startOfPeriod, $lte: endOfPeriod }
      });

      const totalEarnings = earnings.reduce((sum, e) => sum + e.totalEarning, 0);
      const completedDeliveries = earnings.length;
      console.log('   Total Earnings:', totalEarnings, 'Completed Deliveries:', completedDeliveries);

      // 3️⃣ Find highest eligible incentive for this plan
      let highestEligible = null;
      for (const condition of plan.conditions) {
        const currentValue = condition.conditionType === 'earnings' ? totalEarnings : completedDeliveries;
        if (currentValue >= condition.threshold) {
          if (!highestEligible || condition.incentiveAmount > highestEligible.incentiveAmount) {
            highestEligible = condition;
          }
        }
      }

      if (!highestEligible) {
        console.log('   No incentive earned for this plan');
        continue;
      }

      console.log('   Highest eligible incentive:', highestEligible.incentiveAmount);

      // 4️⃣ Upsert incentive record in AgentIncentiveEarning
      const existing = await AgentIncentiveEarning.findOne({
        agentId,
        planId: plan._id,
        periodIdentifier
      });

      if (!existing) {
        console.log('   Creating new incentive record');
        await AgentIncentiveEarning.create({
          agentId,
          planId: plan._id,
          periodType: plan.period,
          periodIdentifier,
          incentiveAmount: highestEligible.incentiveAmount,
          payoutStatus: 'pending'
        });
      } else {
        console.log('   Updating existing incentive record');
        existing.incentiveAmount = highestEligible.incentiveAmount;
        await existing.save();
      }
    }

    console.log('✅ createAgentIncentive completed successfully for agentId:', agentId);
  } catch (err) {
    console.error('❌ Error creating agent incentive:', err);
  }
};

// -------------------
// Helper functions
// -------------------
function getPeriodIdentifier(period, date) {
  if (period === 'daily') return date.toISOString().split('T')[0];
  if (period === 'weekly') return `${date.getFullYear()}-w${getWeekNumber(date)}`;
  if (period === 'monthly') return `${date.getFullYear()}-m${date.getMonth() + 1}`;
}

function getPeriodStartDate(period, date) {
  const d = new Date(date);
  if (period === 'daily') return new Date(d.setHours(0, 0, 0, 0));
  if (period === 'weekly') {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    return new Date(new Date(d.setDate(diff)).setHours(0, 0, 0, 0));
  }
  if (period === 'monthly') return new Date(d.getFullYear(), d.getMonth(), 1);
}

function getPeriodEndDate(period, date) {
  const d = new Date(date);
  if (period === 'daily') return new Date(d.setHours(23, 59, 59, 999));
  if (period === 'weekly') {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? 0 : 7); // Sunday
    return new Date(new Date(d.setDate(diff)).setHours(23, 59, 59, 999));
  }
  if (period === 'monthly') return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

const AgentMilestoneProgress = require("../models/agentMilestoneProgressModel");
const MilestoneReward = require("../models/MilestoneRewardModel");

/**
 * Service function to update agent milestone progress when an order is delivered
 * @param {ObjectId} agentId - The agent ID
 * @param {Object} orderData - Order data containing delivery information
 * @param {boolean} isOnTime - Whether the delivery was on time
 * @param {number} earnings - The earnings from this delivery
 */
exports.updateAgentMilestoneProgress = async (agentId, orderData, isOnTime = false, earnings = 0) => {
  try {
    // Find or create agent milestone progress document
    let agentProgress = await AgentMilestoneProgress.findOne({ agentId })
      .populate({
        path: 'milestones.milestoneId',
        model: 'MilestoneReward'
      });

    if (!agentProgress) {
      // Create new progress document if it doesn't exist
      agentProgress = new AgentMilestoneProgress({
        agentId,
        milestones: []
      });
    }

    // Get all active milestones
    const allMilestones = await MilestoneReward.find({ active: true }).sort({ level: 1 });

    // Initialize milestones if empty
    if (agentProgress.milestones.length === 0) {
      agentProgress.milestones = allMilestones.map(milestone => ({
        milestoneId: milestone._id,
        level: milestone.level,
        conditionsProgress: {
          totalDeliveries: 0,
          onTimeDeliveries: 0,
          totalEarnings: 0
        },
        overallProgress: 0,
        status: milestone.level === 1 ? "In Progress" : "Locked",
        rewardClaimed: {
          claimed: false,
          claimedAt: null
        },
        history: []
      }));
    }

    // Update progress for each milestone
    for (let milestone of agentProgress.milestones) {
      const milestoneConfig = allMilestones.find(m => m._id.toString() === milestone.milestoneId.toString());
      
      if (!milestoneConfig) continue;

      // Skip if already completed or reward claimed
      if (milestone.status === "Completed" || milestone.status === "Reward Claimed") {
        continue;
      }

      // Check if previous level is completed (for levels > 1)
      if (milestone.level > 1) {
        const previousMilestone = agentProgress.milestones.find(m => m.level === milestone.level - 1);
        if (previousMilestone && previousMilestone.status !== "Completed" && previousMilestone.status !== "Reward Claimed") {
          milestone.status = "Locked";
          continue;
        }
      }

      // Update progress values
      const oldProgress = { ...milestone.conditionsProgress };
      
      milestone.conditionsProgress.totalDeliveries += 1;
      if (isOnTime) {
        milestone.conditionsProgress.onTimeDeliveries += 1;
      }
      milestone.conditionsProgress.totalEarnings += earnings;

      // Calculate individual condition progress percentages
      const deliveryProgress = milestoneConfig.conditions.totalDeliveries > 0 
        ? Math.min((milestone.conditionsProgress.totalDeliveries / milestoneConfig.conditions.totalDeliveries) * 100, 100)
        : 0;
      
      const onTimeProgress = milestoneConfig.conditions.onTimeDeliveries > 0 
        ? Math.min((milestone.conditionsProgress.onTimeDeliveries / milestoneConfig.conditions.onTimeDeliveries) * 100, 100)
        : 0;
      
      const earningsProgress = milestoneConfig.conditions.totalEarnings > 0 
        ? Math.min((milestone.conditionsProgress.totalEarnings / milestoneConfig.conditions.totalEarnings) * 100, 100)
        : 0;

      // Calculate overall progress (average of all conditions)
      const totalConditions = [deliveryProgress, onTimeProgress, earningsProgress].filter(p => p > 0).length;
      milestone.overallProgress = totalConditions > 0 
        ? Math.round((deliveryProgress + onTimeProgress + earningsProgress) / totalConditions)
        : 0;

      // Check if milestone is completed
      const isCompleted = 
        milestone.conditionsProgress.totalDeliveries >= milestoneConfig.conditions.totalDeliveries &&
        milestone.conditionsProgress.onTimeDeliveries >= milestoneConfig.conditions.onTimeDeliveries &&
        milestone.conditionsProgress.totalEarnings >= milestoneConfig.conditions.totalEarnings;

      if (isCompleted) {
        milestone.status = "Completed";
        milestone.overallProgress = 100;
      } else {
        milestone.status = "In Progress";
      }

      // Add to history
      milestone.history.push({
        updatedAt: new Date(),
        changes: {
          totalDeliveries: milestone.conditionsProgress.totalDeliveries - oldProgress.totalDeliveries,
          onTimeDeliveries: milestone.conditionsProgress.onTimeDeliveries - oldProgress.onTimeDeliveries,
          totalEarnings: milestone.conditionsProgress.totalEarnings - oldProgress.totalEarnings,
          overallProgress: milestone.overallProgress
        }
      });

      // Keep only last 50 history entries
      if (milestone.history.length > 50) {
        milestone.history = milestone.history.slice(-50);
      }
    }

    await agentProgress.save();
    
    return {
      success: true,
      progress: agentProgress
    };

  } catch (error) {
    console.error("Error updating agent milestone progress:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Helper function to check if delivery was on time
 * @param {Date} estimatedDeliveryTime - Estimated delivery time
 * @param {Date} actualDeliveryTime - Actual delivery time
 * @returns {boolean} - True if delivery was on time
 */
exports.checkOnTimeDelivery = (estimatedDeliveryTime, actualDeliveryTime) => {
  if (!estimatedDeliveryTime || !actualDeliveryTime) return false;
  
  const estimatedTime = new Date(estimatedDeliveryTime);
  const actualTime = new Date(actualDeliveryTime);
  
  // Consider on time if delivered within 15 minutes of estimated time
  const timeDifference = Math.abs(actualTime - estimatedTime);
  return timeDifference <= 15 * 60 * 1000; // 15 minutes in milliseconds
};
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
    console.log("=== updateAgentMilestoneProgress START ===");
    console.log({ agentId, orderId: orderData?._id, isOnTime, earnings });

    // 1️⃣ Find existing agent progress
    let agentProgress = await AgentMilestoneProgress.findOne({ agentId })
      .populate({
        path: 'milestones.milestoneId',
        model: 'MilestoneReward'
      });

    console.log("Existing agent progress:", agentProgress);

    // 2️⃣ Create new progress if none exists
    if (!agentProgress) {
      console.log("No existing progress found. Creating new document...");
      agentProgress = new AgentMilestoneProgress({
        agentId,
        milestones: []
      });
    }

    // 3️⃣ Fetch active milestones
    const allMilestones = await MilestoneReward.find({ active: true }).sort({ level: 1 });
    console.log("Active milestones:", allMilestones);

    if (!allMilestones.length) {
      console.warn("No active milestones found. Exiting function.");
      return { success: false, message: "No active milestones" };
    }

    // 4️⃣ Initialize milestones if empty
    if (agentProgress.milestones.length === 0) {
      console.log("Initializing milestones for agent...");
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
        rewardClaimed: { claimed: false, claimedAt: null },
        history: []
      }));
    }

    // 5️⃣ Update each milestone
    for (let milestone of agentProgress.milestones) {
      const milestoneConfig = allMilestones.find(m => m._id.toString() === milestone.milestoneId.toString());
      if (!milestoneConfig) {
        console.warn("Milestone config not found for:", milestone.milestoneId);
        continue;
      }

      if (milestone.status === "Completed" || milestone.status === "Reward Claimed") continue;

      // Lock if previous milestone not completed
      if (milestone.level > 1) {
        const prev = agentProgress.milestones.find(m => m.level === milestone.level - 1);
        if (prev && prev.status !== "Completed" && prev.status !== "Reward Claimed") {
          milestone.status = "Locked";
          continue;
        }
      }

      // 6️⃣ Save old progress for history
      const oldProgress = { ...milestone.conditionsProgress };

      // 7️⃣ Update progress values
      milestone.conditionsProgress.totalDeliveries += 1;
      if (isOnTime) milestone.conditionsProgress.onTimeDeliveries += 1;
      milestone.conditionsProgress.totalEarnings += earnings;

      // 8️⃣ Calculate progress percentages
      const deliveryProgress = milestoneConfig.conditions.totalDeliveries
        ? Math.min((milestone.conditionsProgress.totalDeliveries / milestoneConfig.conditions.totalDeliveries) * 100, 100)
        : 0;

      const onTimeProgress = milestoneConfig.conditions.onTimeDeliveries
        ? Math.min((milestone.conditionsProgress.onTimeDeliveries / milestoneConfig.conditions.onTimeDeliveries) * 100, 100)
        : 0;

      const earningsProgress = milestoneConfig.conditions.totalEarnings
        ? Math.min((milestone.conditionsProgress.totalEarnings / milestoneConfig.conditions.totalEarnings) * 100, 100)
        : 0;

      const totalConditions = [deliveryProgress, onTimeProgress, earningsProgress].filter(p => p > 0).length;
      milestone.overallProgress = totalConditions > 0
        ? Math.round((deliveryProgress + onTimeProgress + earningsProgress) / totalConditions)
        : 0;

      // 9️⃣ Check completion
      const isCompleted = 
        milestone.conditionsProgress.totalDeliveries >= milestoneConfig.conditions.totalDeliveries &&
        milestone.conditionsProgress.onTimeDeliveries >= milestoneConfig.conditions.onTimeDeliveries &&
        milestone.conditionsProgress.totalEarnings >= milestoneConfig.conditions.totalEarnings;

      milestone.status = isCompleted ? "Completed" : "In Progress";
      if (isCompleted) milestone.overallProgress = 100;

      // 10️⃣ Add history
      milestone.history.push({
        updatedAt: new Date(),
        changes: {
          totalDeliveries: milestone.conditionsProgress.totalDeliveries - oldProgress.totalDeliveries,
          onTimeDeliveries: milestone.conditionsProgress.onTimeDeliveries - oldProgress.onTimeDeliveries,
          totalEarnings: milestone.conditionsProgress.totalEarnings - oldProgress.totalEarnings,
          overallProgress: milestone.overallProgress
        }
      });
      if (milestone.history.length > 50) milestone.history = milestone.history.slice(-50);
    }

    // 11️⃣ Save agent progress
    try {
      await agentProgress.save();
      console.log("Agent milestone progress saved successfully");
    } catch (err) {
      console.error("Error saving agent milestone progress:", err.message);
      return { success: false, error: err.message };
    }

    console.log("=== updateAgentMilestoneProgress END ===");
    return { success: true, progress: agentProgress };

  } catch (error) {
    console.error("Error in updateAgentMilestoneProgress:", error);
    return { success: false, error: error.message };
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
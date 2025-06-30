const AllocationSettings = require("../models/AllocationSettingsModel");
const Agent = require("../models/agentModel");
const Order = require("../models/orderModel");
const Restaurant = require("../models/restaurantModel");

/**
 * Assign an agent to an order based on the current allocation method
 */
exports.assignTask = async (orderId) => {
  try { 
    const settings = await AllocationSettings.findOne({});
    if (!settings) throw new Error("Allocation settings not configured");
    if (!settings.isAutoAllocationEnabled) {
      console.log("⚠️ Auto allocation is turned off. Manual assignment required.");
      return { status: "manual_assignment_required" };
    }

    console.log(`⏳ Allocating task using method: ${settings.method}`);

    switch (settings.method) {
      case "nearest_available":
        return await assignNearestAvailable(
          orderId,
          settings.nearestAvailableSettings
        );

      case "one_by_one":
        return await assignOneByOne(orderId);

      case "round_robin":
        return await assignRoundRobin(orderId, settings.roundRobinSettings);

      // Add other cases when needed...
      default:
        console.log(`⚠️ No allocation method matched: ${settings.method}`);
        return {
          status: "not_assigned",
          reason: "No matching allocation method",
        };
    }
  } catch (error) {
    console.error("❌ Task Allocation Failed:", error);
    return { status: "failed", error: error.message };
  }
};

/**
 * Nearest Available Agent Assignment Logic
 */
const assignNearestAvailable = async (orderId, config) => {
  console.log("📌 Nearest Available Assignment started...");

  // Fetch order
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  // Fetch restaurant location
  const restaurant = await Restaurant.findById(order.restaurantId);
  if (!restaurant) throw new Error("Restaurant not found");

  // Find available agents within radius
  const availableAgents = await Agent.find({
    "agentStatus.availabilityStatus": "AVAILABLE",
    "agentStatus.status": "AVAILABLE",
    location: {
      $near: {
        $geometry: restaurant.location,
        $maxDistance: config.maximumRadiusKm * 1000, // convert to meters
      },
    },
  }).limit(10);

  if (!availableAgents.length) {
    console.log("❌ No available agents nearby.");
    return { status: "not_assigned", reason: "No agents available nearby" };
  }

  // Prioritize by rating if enabled
  let selectedAgent;
  if (config.considerAgentRating) {
    selectedAgent = availableAgents.sort(
      (a, b) =>
        (b.feedback.averageRating || 0) - (a.feedback.averageRating || 0)
    )[0];
  } else {
    selectedAgent = availableAgents[0];
  }

  // Assign agent to order
  order.assignedAgent = selectedAgent._id;
  order.agentAssignmentStatus = "assigned";
  await order.save();

  // ✅ Update agent's status to ORDER_ASSIGNED
  selectedAgent.agentStatus.status = "ORDER_ASSIGNED";
  await selectedAgent.save();

  console.log(`✅ Assigned to agent: ${selectedAgent.fullName}`);

  return { status: "assigned", agent: selectedAgent };
};

/**
 * One by One Agent Assignment Logic
 */
const assignOneByOne = async (orderId) => {
  console.log("📌 One by One Assignment started...");

  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  // Find first available agent
  const agent = await Agent.findOne({
    availability: "Available",
    status: "Active",
  }).sort({ lastAssignedAt: 1 });

  if (!agent) {
    console.log("❌ No available agents.");
    return { status: "not_assigned", reason: "No agents available" };
  }

  // Assign and update order
  order.agentId = agent._id;
  order.agentAssignmentStatus = "assigned";
  await order.save();

  // Update agent's lastAssignedAt
  agent.lastAssignedAt = new Date();
  await agent.save();

  console.log(`✅ Task assigned to agent ${agent.name}`);
  return { status: "assigned", agent };
};

/**
 * Round Robin Agent Assignment Logic
 */
const assignRoundRobin = async (orderId, config) => {
  console.log("📌 Round Robin Assignment started...");

  // Fetch order
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  // Fetch restaurant location
  const restaurant = await Restaurant.findById(order.restaurantId);
  if (!restaurant) throw new Error("Restaurant not found");

  // Fetch available agents within radius
  const availableAgents = await Agent.find({
    "agentStatus.status": "AVAILABLE",
    "agentStatus.availabilityStatus": "AVAILABLE",
    location: {
      $near: {
        $geometry: restaurant.location,
        $maxDistance: config.radiusKm * 1000, // convert to meters
      },
    },
  }).sort({ lastAssignedAt: 1 }); // Round Robin: oldest assigned agent first

  if (!availableAgents.length) {
    console.log("❌ No available agents in radius.");
    return { status: "not_assigned", reason: "No agents available in range" };
  }

  // Filter agents who haven't hit max tasks
  const eligibleAgents = [];

  for (const agent of availableAgents) {
    const orderCount = await Order.countDocuments({
      assignedAgent: agent._id,
      status: {
        $in: [
          "ORDER_ASSIGNED",
          "ORDER_ACCEPTED",
          "PICKED_UP",
          "ON_THE_WAY",
          "AT_CUSTOMER_LOCATION",
        ],
      },
    });

    if (orderCount < config.maxTasksAllowed) {
      eligibleAgents.push({ agent, orderCount });
    }
  }

  if (!eligibleAgents.length) {
    console.log("❌ No eligible agents below max task limit.");
    return { status: "not_assigned", reason: "All agents at max capacity" };
  }

  // Prioritize by rating if enabled
  let selectedAgent;
  if (config.considerAgentRating) {
    selectedAgent = eligibleAgents.sort(
      (a, b) =>
        (b.agent.feedback.averageRating || 0) -
        (a.agent.feedback.averageRating || 0)
    )[0].agent;
  } else {
    selectedAgent = eligibleAgents[0].agent;
  }

  // Assign agent to order
  order.assignedAgent = selectedAgent._id;
  order.agentAssignmentStatus = "assigned";
  await order.save();

  // Update agent status & lastAssignedAt
  selectedAgent.agentStatus.status = "ORDER_ASSIGNED";
  selectedAgent.lastAssignedAt = new Date();
  await selectedAgent.save();

  console.log(`✅ Assigned to agent: ${selectedAgent.fullName}`);

  return { status: "assigned", agent: selectedAgent };
};

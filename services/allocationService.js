const AllocationSettings = require("../models/AllocationSettingsModel");
const Agent = require("../models/agentModel");
const Order = require("../models/orderModel");
const Restaurant = require("../models/restaurantModel");
const agenda = require("../config/agenda");
const sendNotificationToAgent = require("../utils/sendNotificationToAgent");
/**
 * Assign an agent to an order based on the current allocation method
 */
assignTask = async (orderId) => {
  try {
    const settings = await AllocationSettings.findOne({});
    if (!settings) throw new Error("Allocation settings not configured");
    if (!settings.isAutoAllocationEnabled) {
      console.log(
        "⚠️ Auto allocation is turned off. Manual assignment required."
      );
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

      case "send_to_all":
        return await assignSendToAll(orderId, settings.sendToAllSettings);


       case "fifo":
        return await assignFIFO(orderId, settings.fifoSettings);

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
    return { status: "unassigned", reason: "No agents available nearby" };
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
  console.log("📌 Starting One-by-One Agent Assignment...");

  try {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");
    if (order.assignedAgent) return { status: "already_assigned" };

    const restaurant = await Restaurant.findById(order.restaurantId);
    if (!restaurant?.location) throw new Error("Restaurant location not set.");

    const nearbyAgents = await Agent.find({
      "agentStatus.status": "AVAILABLE",
      "agentStatus.availabilityStatus": "AVAILABLE",
      location: {
        $near: {
          $geometry: restaurant.location,
          $maxDistance: 50000,
        },
      },
    }).limit(10);

    if (!nearbyAgents.length) {
      console.log("❌ No nearby agents found.");
      return { status: "unassigned", reason: "No agents nearby" };
    }

    // Fetch allocation settings for one_by_one
    const allocationSettings = await AllocationSettings.findOne({});
    const expirySec = allocationSettings?.oneByOneSettings?.requestExpirySec || 120;

    const now = new Date();

    const candidates = nearbyAgents.map((agent, index) => ({
      agent: agent._id,
      status: index === 0 ? "sent" : "queued",
      assignedAt: now,
      notifiedAt: index === 0 ? now : null,
      respondedAt: null,
      isCurrentCandidate: index === 0,
      attemptNumber: 1,
    }));

    order.agentCandidates = candidates;
    order.agentAssignmentStatus = "awaiting_agent_acceptance";
    order.allocationMethod = "one_by_one";
    await order.save();

    const firstAgent = nearbyAgents[0];

    // Send notification to agent
    await sendNotificationToAgent({
      agentId: firstAgent._id,
      title: "New Delivery Task",
      body: "You have a new delivery assignment. Please accept or decline.",
      data: {
        type: "ORDER_ASSIGNMENT",
        orderId: order._id.toString(),
        customerName: order.customerName || "Customer",
        address: order.deliveryAddress?.formatted || "",
      },
    });

    console.log(`📨 First agent (${firstAgent.fullName}) notified for order ${orderId}`);

    // Schedule timeout check
    const job = await agenda.schedule(new Date(Date.now() + expirySec * 1000), "checkAgentResponseTimeout", {
      orderId: order._id.toString(),
      agentId: firstAgent._id.toString(),
    });

    console.log(`⏳ Timeout job (ID: ${job.attrs._id}) scheduled for Agent ${firstAgent.fullName} on Order ${order._id} with expiry ${expirySec} seconds`);

    return {
      status: "first_agent_notified",
      agentId: firstAgent._id,
      candidateCount: nearbyAgents.length,
      jobId: job.attrs._id,
    };
  } catch (error) {
    console.error("Error in assignOneByOne:", error);
    throw error;
  }
};

/**
 * Round Robin Agent Assignment Logic
 */
const assignRoundRobin = async (orderId, config) => {
  console.log("📌 Round Robin Assignment started...");

  // Fetch order
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  console.log(`📝 Order fetched: ${order._id}`);

  if (order.assignedAgent) {
    console.log("⚠️ Order already has an assigned agent:", order.assignedAgent);
    return { status: "already_assigned" };
  }

  // Fetch restaurant location
  const restaurant = await Restaurant.findById(order.restaurantId);
  if (!restaurant?.location) throw new Error("Restaurant location not found.");
  console.log(`🏪 Restaurant location: ${JSON.stringify(restaurant.location)}`);

  // Start radius search
  let radius = config.radiusKm || 3;
  let availableAgents = [];

  while (radius <= (config.maximumRadiusKm || 10) && availableAgents.length === 0) {
    console.log(`🔍 Searching agents within ${radius} km...`);

    availableAgents = await Agent.find({
      "agentStatus.status": "AVAILABLE",
      "agentStatus.availabilityStatus": "AVAILABLE",
      location: {
        $near: {
          $geometry: restaurant.location,
          $maxDistance: radius * 1000,
        },
      },
    });

    console.log(`🔹 Found ${availableAgents.length} agents in radius ${radius} km`);

    if (!availableAgents.length) {
      radius += config.radiusIncrementKm || 2;
      console.log(`🔄 Expanding search radius to ${radius} km`);
    }
  }

  if (!availableAgents.length) {
    console.log("❌ No available agents found in any radius.");
    return { status: "unassigned", reason: "No agents available in radius" };
  }

  // Filter agents below maxTasksAllowed using agentDeliveryStatus
  const eligibleAgents = [];
  for (const agent of availableAgents) {
    const activeTaskCount = await Order.countDocuments({
      assignedAgent: agent._id,
      agentAssignmentStatus: "assigned",
      agentDeliveryStatus: {
        $in: [
          "start_journey_to_restaurant",
          "reached_restaurant",
          "picked_up",
          "out_for_delivery",
          "reached_customer",
        ],
      },
    });

    console.log(
      `👤 Agent ${agent.fullName} has ${activeTaskCount} active tasks`
    );

    if (activeTaskCount < (config.maxTasksAllowed || 20)) {
      eligibleAgents.push(agent);
      console.log(`✅ Agent ${agent.fullName} eligible`);
    } else {
      console.log(`❌ Agent ${agent.fullName} at max capacity`);
    }
  }

  if (!eligibleAgents.length) {
    console.log("❌ No eligible agents below max task limit.");
    return { status: "unassigned", reason: "All agents at max capacity" };
  }

  // Sort by rating if enabled
  if (config.considerAgentRating) {
    eligibleAgents.sort(
      (a, b) => (b.feedback?.averageRating || 0) - (a.feedback?.averageRating || 0)
    );
    console.log(
      "⭐ Agents sorted by rating:",
      eligibleAgents.map(a => `${a.fullName} (${a.feedback?.averageRating || 0})`)
    );
  }

  // Round Robin: least recently assigned first
  eligibleAgents.sort((a, b) => (a.lastAssignedAt || 0) - (b.lastAssignedAt || 0));
  console.log(
    "🔄 Agents sorted by lastAssignedAt:",
    eligibleAgents.map(a => `${a.fullName} (${a.lastAssignedAt})`)
  );

  const selectedAgent = eligibleAgents[0];
  console.log(`🎯 Selected agent: ${selectedAgent.fullName}`);

  // Assign order
  order.assignedAgent = selectedAgent._id;
  order.agentAssignmentStatus = "assigned";
  order.allocationMethod = "round_robin";
  await order.save();
  console.log(`📌 Order ${order._id} assigned to ${selectedAgent.fullName}`);

  // Update agent status & lastAssignedAt
  selectedAgent.agentStatus.status = "ORDER_ASSIGNED";
  selectedAgent.lastAssignedAt = new Date();
  await selectedAgent.save();
  console.log(`🔹 Agent ${selectedAgent.fullName} status updated`);

  // Send notification
  await sendNotificationToAgent({
    agentId: selectedAgent._id,
    title: "📦 New Delivery Task (Round Robin)",
    body: "You have been assigned a new delivery task.",
    data: {
      type: "ORDER_ASSIGNMENT",
      orderId: order._id.toString(),
      customerName: order.customerName || "Customer",
      address: order.deliveryAddress?.formatted || "",
    },
  });

  console.log("📨 Notification sent to agent");

  return { status: "assigned", agent: selectedAgent };
};





const notifyNextPendingAgent = async (order, agenda) => {
  try {
    // Re-fetch fresh order to avoid stale data
    const freshOrder = await Order.findById(order._id);
    if (!freshOrder) {
      console.log(`❌ Order ${order._id} not found`);
      return { status: "order_not_found" };
    }

    // Find the next agent candidate who is queued/waiting
    const nextCandidate = freshOrder.agentCandidates.find(
      (c) => c.status === "queued" || c.status === "waiting"
    );

    if (!nextCandidate) {
      console.log("❌ No more agents left to notify.");
      freshOrder.agentAssignmentStatus = "unassigned";
      await freshOrder.save();
      return { status: "no_more_candidates" };
    }

    // Clear previous current candidate
    freshOrder.agentCandidates.forEach((c) => (c.isCurrentCandidate = false));

    // Update next candidate to pending
    nextCandidate.status = "pending";
    nextCandidate.assignedAt = new Date();
    nextCandidate.notifiedAt = new Date();
    nextCandidate.isCurrentCandidate = true;
    nextCandidate.attemptNumber = (nextCandidate.attemptNumber || 0) + 1;

    // Save updated order
    await freshOrder.save();

    // Fetch agent details
    const nextAgent = await Agent.findById(nextCandidate.agent);
    if (!nextAgent) {
      console.log(`⚠️ Agent ${nextCandidate.agent} not found in DB`);
      nextCandidate.status = "failed";
      await freshOrder.save();
      return await notifyNextPendingAgent(freshOrder, agenda);
    }

    // Determine expiry time dynamically based on allocation method
    const allocationSettings = await AllocationSettings.findOne({});
    let expirySec = 25; // fallback default
    const method = freshOrder.allocationMethod || "one_by_one";

    switch (method) {
      case "one_by_one":
        expirySec = allocationSettings?.oneByOneSettings?.requestExpirySec || expirySec;
        break;
      case "send_to_all":
        expirySec = allocationSettings?.sendToAllSettings?.requestExpirySec || expirySec;
        break;
      case "fifo":
        expirySec = allocationSettings?.fifoSettings?.requestExpirySec || expirySec;
        break;
    }

    // Log dynamically
    console.log(`🔁 Notifying next agent (${method}): ${nextAgent.fullName} (Attempt: ${nextCandidate.attemptNumber}) for ${expirySec}s`);

    // Send push/notification dynamically
    await sendNotificationToAgent({
      agentId: nextAgent._id,
      title: `📦 New Delivery Task (${method.toUpperCase()})`,
      body: "You have a new delivery request. Please accept or decline.",
      data: {
        orderId: freshOrder._id.toString(),
        type: "order_allocation",
        expirySec: String(expirySec),
        allocationMethod: method,
      },
    });

    // Schedule timeout job
    await agenda.schedule(`in ${expirySec} seconds`, "checkAgentResponseTimeout", {
      orderId: freshOrder._id.toString(),
      agentId: nextAgent._id.toString(),
    });

    console.log(`⏳ Timeout scheduled for ${nextAgent.fullName} in ${expirySec}s`);

    return { 
      status: "next_agent_notified", 
      agentId: nextAgent._id, 
      expirySec,
      candidateIndex: freshOrder.agentCandidates.findIndex(c => c.agent.toString() === nextAgent._id.toString())
    };
  } catch (err) {
    console.error("🚨 notifyNextPendingAgent error:", err);
    return { status: "notification_failed", error: err.message || err.toString() };
  }
};





const assignSendToAll = async (orderId) => {
  console.log("📢 [Send-to-All] Assignment started...", { orderId });

  const order = await Order.findById(orderId);
  if (!order) throw new Error("❌ [Send-to-All] Order not found");
  if (order.assignedAgent) {
    console.log("⚠️ [Send-to-All] Order already assigned, skipping...");
    return { status: "already_assigned" };
  }

  const restaurant = await Restaurant.findById(order.restaurantId);
  if (!restaurant?.location) throw new Error("❌ [Send-to-All] Restaurant location not found");

  const allocationSettings = await AllocationSettings.findOne({});
  const config = allocationSettings?.sendToAllSettings || {};

  let radiusKm = config.radiusKm || 5;
  const maxRadius = config.maximumRadiusKm || 20;
  const radiusIncrement = config.radiusIncrementKm || 2;
  const maxAgents = config.maxAgents || 500;
  const requestExpirySec = config.requestExpirySec || 30;

  let availableAgents = [];
  console.log(
    `🔍 [Send-to-All] Searching agents (start=${radiusKm}km, max=${maxRadius}km, step=${radiusIncrement}km)...`
  );

  while (radiusKm <= maxRadius && availableAgents.length === 0) {
    console.log(`➡️ [Send-to-All] Checking within ${radiusKm} km...`);
    availableAgents = await Agent.find({
      "agentStatus.status": "AVAILABLE",
      "agentStatus.availabilityStatus": "AVAILABLE",
      location: {
        $near: {
          $geometry: restaurant.location,
          $maxDistance: radiusKm * 1000,
        },
      },
    }).limit(maxAgents);

    if (!availableAgents.length) {
      console.log(`❌ [Send-to-All] No agents found in ${radiusKm} km, expanding...`);
      radiusKm += radiusIncrement;
    }
  }

  if (!availableAgents.length) {
    console.log("❌ [Send-to-All] No available agents found after full search.");
    return { status: "unassigned", reason: "No agents found" };
  }

  console.log(`✅ [Send-to-All] Found ${availableAgents.length} agents (within ${radiusKm} km)`);

  // 🔹 Log agent list for debugging
  const agentListToLog = availableAgents.map(agent => ({
    id: agent._id.toString(),
    name: agent.fullName,
    location: agent.location,
  }));
  console.log("💾 [Send-to-All] Agent list:", agentListToLog);

  const now = new Date();
  order.agentCandidates = availableAgents.map(agent => ({
    agent: agent._id,
    status: "broadcasted",
    assignedAt: now,
    respondedAt: null,
    isCurrentCandidate: true,
  }));

  order.agentAssignmentStatus = "awaiting_agent_acceptance";
  order.allocationMethod = "send_to_all";
  await order.save();

  for (const agent of availableAgents) {
    console.log(`📨 [Send-to-All] Sending notification to agent ${agent.fullName}`);
    await sendNotificationToAgent({
      agentId: agent._id,
      title: "📦 New Task Available",
      body: "You have a new delivery task. Accept before others do!",
      data: {
        type: "ORDER_ASSIGNMENT",
        orderId: order._id.toString(),
        customerName: order.customerName || "Customer",
        address: order.deliveryAddress?.formatted || "",
        expirySec: String(requestExpirySec),
        allocationMethod: "send_to_all",
      },
    });
  }

  if (requestExpirySec) {
    await agenda.schedule(
      `in ${requestExpirySec} seconds`,
      "checkOrderAssignmentTimeout",
      { orderId: order._id.toString() }
    );
    console.log(`⏳ [Send-to-All] Auto-cancel scheduled after ${requestExpirySec}s`);
  }

  console.log("🏁 [Send-to-All] Assignment process completed.", {
    orderId,
    notifiedAgents: availableAgents.length,
    radiusUsed: radiusKm,
  });

  return {
    status: "notified_all",
    notifiedAgents: availableAgents.length,
    radiusUsed: radiusKm,
  };
};





function formatDuration(ms) {
  if (!ms || ms <= 0) return "0s ago";
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (day > 0) return `${day}d ago`;
  if (hr > 0) return `${hr}h ago`;
  if (min > 0) return `${min}m ago`;
  return `${sec}s ago`;
}

// FIFO Assignment
const assignFIFO = async (orderId, config) => {
  console.log(`\n🎯 ========== FIFO ASSIGNMENT STARTED ==========`);
  console.log(`📦 Order ID: ${orderId}`);
  console.log(`⚙️  Config: autoAcceptOrders=${config.autoAcceptOrders}, startRadiusKm=${config.startRadiusKm}, maxRadiusKm=${config.maximumRadiusKm}`);

  const order = await Order.findById(orderId);
  if (!order) {
    console.log(`❌ ORDER NOT FOUND: ${orderId}`);
    throw new Error("Order not found");
  }
  console.log(`✅ Order found: ${order._id}`);

  const restaurant = await Restaurant.findById(order.restaurantId);
  if (!restaurant) {
    console.log(`❌ RESTAURANT NOT FOUND: ${order.restaurantId}`);
    throw new Error("Restaurant not found");
  }
  console.log(`✅ Restaurant found: ${restaurant.name}`);

  let radiusKm = config.startRadiusKm || 3;
  const maxRadius = config.maximumRadiusKm || 10;
  const radiusIncrement = config.radiusIncrementKm || 2;

  let availableAgents = [];
  let searchAttempts = 0;

  console.log(`\n🔍 STARTING AGENT SEARCH...`);
  console.log(`📍 Search radius: ${radiusKm}km to ${maxRadius}km (increment: ${radiusIncrement}km)`);

  // Search agents within radius
  while (radiusKm <= maxRadius && availableAgents.length === 0) {
    searchAttempts++;
    console.log(`\n📡 Search attempt ${searchAttempts}: Radius ${radiusKm}km`);
    
    const agents = await Agent.find({
      "agentStatus.status": "AVAILABLE",
      "agentStatus.availabilityStatus": "AVAILABLE",
      location: {
        $near: {
          $geometry: restaurant.location,
          $maxDistance: radiusKm * 1000,
        },
      },
    });

    console.log(`📊 Found ${agents.length} agents within ${radiusKm}km radius`);

    availableAgents = await Promise.all(
      agents.map(async (agent) => {
        if (!agent) return null;

        const lastDeliveredOrder = await Order.findOne({
          assignedAgent: agent._id,
          agentDeliveryStatus: "delivered",
        }).sort({ deliveredAt: -1 });

        let freeDurationMs;
        let humanReadable;

        if (lastDeliveredOrder?.deliveredAt) {
          freeDurationMs = Math.max(new Date() - new Date(lastDeliveredOrder.deliveredAt), 0);
          humanReadable = formatDuration(freeDurationMs);
        } else {
          freeDurationMs = Number.MAX_SAFE_INTEGER;
          humanReadable = "🆕 New Agent (never delivered)";
        }

        console.log(`   👤 Agent: ${agent.fullName || "Unknown"}, Free Time: ${humanReadable}`);
        return { ...agent.toObject(), freeDurationMs, humanReadable };
      })
    );

    availableAgents = availableAgents.filter(a => a !== null);
    
    if (availableAgents.length === 0) {
      console.log(`➡️  No available agents in ${radiusKm}km radius, expanding search...`);
      radiusKm += radiusIncrement;
    } else {
      console.log(`✅ Found ${availableAgents.length} available agents in ${radiusKm}km radius`);
    }
  }

  if (!availableAgents.length) {
    console.log(`\n❌ NO AGENTS FOUND: No available agents within ${maxRadius}km radius`);
    return { 
      status: "unassigned", 
      reason: "No agents available",
      searchRadius: maxRadius,
      searchAttempts 
    };
  }

  console.log(`\n📊 SORTING AGENTS BY FREE DURATION (FIFO)...`);
  // Sort by longest free duration (FIFO)
  availableAgents.sort((a, b) => b.freeDurationMs - a.freeDurationMs);

  console.log(`📋 Sorted agent list:`);
  availableAgents.forEach((a, i) => {
    console.log(`   ${i + 1}. ${a.fullName} - Free Time: ${a.humanReadable} (${a.freeDurationMs}ms)`);
  });

  // Tie-breaker using rating if enabled
  if (config.considerAgentRating) {
    console.log(`\n⭐ APPLYING RATING TIE-BREAKER...`);
    availableAgents.sort((a, b) => {
      if (a.freeDurationMs === b.freeDurationMs) {
        const ratingA = a.feedback?.averageRating || 0;
        const ratingB = b.feedback?.averageRating || 0;
        console.log(`   🔄 Tie between ${a.fullName} (${ratingA}) and ${b.fullName} (${ratingB})`);
        return ratingB - ratingA;
      }
      return 0;
    });
  }

  const now = new Date();
  console.log(`\n👥 BUILDING AGENT CANDIDATE QUEUE...`);

  // Build agent candidate queue
  order.agentCandidates = availableAgents.map((agent, idx) => ({
    agent: agent._id,
    status: idx === 0 && !config.autoAcceptOrders ? "pending" : "queued",
    assignedAt: now,
    notifiedAt: idx === 0 && !config.autoAcceptOrders ? now : null,
    respondedAt: null,
    isCurrentCandidate: idx === 0 && !config.autoAcceptOrders,
    attemptNumber: 1,
    freeDurationMs: agent.freeDurationMs,
  }));

  console.log(`📋 Candidate queue created:`);
  order.agentCandidates.forEach((c, i) => {
    console.log(`   ${i + 1}. Agent ${c.agent} - Status: ${c.status}, Current: ${c.isCurrentCandidate}`);
  });

  order.agentAssignmentStatus = config.autoAcceptOrders ? "assigned" : "awaiting_agent_acceptance";
  order.allocationMethod = "fifo";
  order.assignedAgent = config.autoAcceptOrders ? availableAgents[0]._id : null;
  
  await order.save();
  console.log(`💾 Order saved with assignment status: ${order.agentAssignmentStatus}`);

  if (config.autoAcceptOrders) {
    console.log(`\n🤖 AUTO-ACCEPT FLOW (autoAcceptOrders=true)`);
    const firstAgent = availableAgents[0];
    
    console.log(`✅ Auto-assigning to agent: ${firstAgent.fullName}`);
    await Agent.findByIdAndUpdate(firstAgent._id, {
      "agentStatus.status": "ORDER_ASSIGNED",
      lastAssignedAt: new Date(),
    });
    
    console.log(`📨 Sending auto-accept notification to ${firstAgent.fullName}`);
    await sendNotificationToAgent({
      agentId: firstAgent._id,
      title: "New Delivery Task (FIFO)",
      body: "You have a new delivery assignment (auto-accepted).",
      data: {
        type: "ORDER_ASSIGNMENT",
        orderId: order._id.toString(),
      },
    });
    
    console.log(`🎉 AUTO-ASSIGNMENT COMPLETE: ${firstAgent.fullName}`);
    
    return { 
      status: "assigned", 
      agent: firstAgent,
      autoAccepted: true,
      totalCandidates: availableAgents.length
    };
  } else {
    console.log(`\n🔔 ONE-BY-ONE NOTIFICATION FLOW (autoAcceptOrders=false)`);
    const firstAgent = availableAgents[0];
    
    console.log(`📨 Sending notification to first agent: ${firstAgent.fullName}`);
    await sendNotificationToAgent({
      agentId: firstAgent._id,
      title: "📦 New Delivery Task (FIFO)",
      body: "You have a new delivery request. Please accept or decline.",
      data: {
        orderId: order._id.toString(),
        type: "order_allocation",
        expirySec: String(config.requestExpirySec || 25),
        allocationMethod: "fifo",
      },
    });

    const expirySec = config.requestExpirySec || 25;
    console.log(`⏰ Scheduling timeout job for ${expirySec} seconds`);
    await agenda.schedule(`in ${expirySec} seconds`, "checkAgentResponseTimeout", {
      orderId: order._id.toString(),
      agentId: firstAgent._id.toString(),
    });

    console.log(`✅ FIRST AGENT NOTIFIED: ${firstAgent.fullName}`);
    console.log(`⏳ Waiting for response (timeout: ${expirySec}s)`);
    console.log(`📊 Total candidates in queue: ${availableAgents.length}`);

    return {
      status: "first_agent_notified",
      agentId: firstAgent._id,
      agentName: firstAgent.fullName,
      candidateCount: availableAgents.length,
      expirySec: expirySec,
      searchRadius: radiusKm,
      searchAttempts: searchAttempts
    };
  }
};


module.exports = {assignTask, notifyNextPendingAgent };
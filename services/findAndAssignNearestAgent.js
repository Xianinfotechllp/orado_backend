  const Agent = require("../models/agentModel");
  const Order = require("../models/orderModel")
  const { sendPushNotification } = require("../utils/sendPushNotification"); // Adjust path as needed

  /**
   * Finds the nearest available agent within a specified distance
   * and assigns them to an order.
   * 
   * @param {String} orderId - The ID of the order to assign.
   * @param {Object} deliveryLocation - { longitude, latitude } of the order delivery point.
   * @param {Number} maxDistance - Maximum distance in meters to look for an agent (default 5000m).
   * @returns {Object|null} - The assigned agent document or null if no agent found.
   */
exports.findAndAssignNearestAgent = async (orderId, deliveryLocation, maxDistance = 5000) => {
  try {
    const { longitude, latitude } = deliveryLocation;


    const order = await Order.findById(orderId)
      .select("paymentMethod totalAmount rejectionHistory");

    if (!order) throw new Error("Order not found");

    const rejectedAgentIds = order.rejectionHistory?.map(r => r.agentId) || [];

    const agentQuery = {
      _id: { $nin: rejectedAgentIds },
      availabilityStatus: "Available",
      $and: [
        {
          $or: [
            { "permissions.canAcceptOrRejectOrders": false },
            {
              "permissions.canAcceptOrRejectOrders": true,
              "deliveryStatus.status": { $ne: "in_progress" }
            }
          ]
        },
        {
          $or: [
            { "permissions.maxActiveOrders": 0 },
            {
              $expr: {
                $lt: ["$deliveryStatus.currentOrderCount", "$permissions.maxActiveOrders"]
              }
            }
          ]
        }
      ],
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [longitude, latitude] },
          $maxDistance: maxDistance
        }
      }
    };

    if (order.paymentMethod === "cash") {
      agentQuery.$and.push({
        $expr: {
          $lt: [
            { $add: ["$codTracking.currentCODHolding", order.totalAmount] },
            "$permissions.maxCODAmount"
          ]
        }
      });
    }
    console.log("Running agentQuery:", JSON.stringify(agentQuery, null, 2));

    const nearbyAgent = await Agent.findOne(agentQuery);

    if (!nearbyAgent) {
  console.log("No agent found. Double check all conditions.");
}


    if (nearbyAgent) {
      let orderStatusUpdate;
      let agentStatusUpdate;

      if (nearbyAgent.permissions.canAcceptOrRejectOrders) {
        orderStatusUpdate = "pending_agent_acceptance";
        agentStatusUpdate = "pending_agent_acceptance";
      } else {
        orderStatusUpdate = "assigned_to_agent";
        agentStatusUpdate = "assigned_to_agent";
      }

      // Update Order
      await Order.findByIdAndUpdate(orderId, {
        assignedAgent: nearbyAgent._id,
        orderStatus: orderStatusUpdate,
      });
      console.log("Updated order:", orderId, "with agent:", nearbyAgent._id);
      // Update Agent
      const agentUpdate = {
        $inc: {
          "deliveryStatus.currentOrderCount": 1,
          ...(order.paymentMethod === "cash" && {
            "codTracking.currentCODHolding": order.totalAmount,
          }),
        },
        "deliveryStatus.status": agentStatusUpdate,
        $addToSet: {
          "deliveryStatus.currentOrderIds": orderId, // <-- add to array without duplicates
        },
      };


      await Agent.findByIdAndUpdate(nearbyAgent._id, agentUpdate);
      console.log("Assigned agent:", nearbyAgent._id, "to order:", orderId);
      
      // ✅ Send FCM Notification
      const title = "New Order Assigned";
      const body = "You have a new delivery order. Please check the app.";
      await sendPushNotification(nearbyAgent.userId, title, body);

      return nearbyAgent;
    }

    return null;
  } catch (error) {
    console.error("Error in findAndAssignNearestAgent:", error);
    throw error;
  }
};



exports.assignNearestAgentSimple = async (orderId) => {
  try {
    // 1. Get the order
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    // 2. Find any available agent (no filters)
    const agent = await Agent.findOne({
      availabilityStatus: "Available"
    });

    if (!agent) {
      throw new Error('No available agents');
    }
    // 3. Update the order
    order.assignedAgent = agent._id;
    await order.save();

    // 4. Update agent's status (minimal fields)
    agent.deliveryStatus.status = 'assigned_to_agent';
    await agent.save();

    return {
      success: true,
      agentId: agent._id,
     
    };
  } catch (error) {
    console.error('Simple agent assignment error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};



exports.assignRandomAgentSimple = async (orderId) => {
  try {
    // 1. Get the order
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    // 2. Get a random available agent
    const agents = await Agent.aggregate([
      { $match: { availabilityStatus: "Available" } },
      { $sample: { size: 1 } }
    ]);

    if (!agents || agents.length === 0) {
      throw new Error('No available agents');
    }

    const agent = agents[0];

    // 3. Update the order
    order.assignedAgent = agent._id;
    await order.save();

    // 4. Update agent's status directly in DB
    await Agent.findByIdAndUpdate(agent._id, {
      "deliveryStatus.status": "assigned_to_agent"
    });

    return {
      success: true,
      agentId: agent._id,
    };
  } catch (error) {
    console.error('Random agent assignment error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

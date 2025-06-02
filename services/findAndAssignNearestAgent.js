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
              "deliveryStatus.status": { $ne: "In Progress" }
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

    const nearbyAgent = await Agent.findOne(agentQuery);

    if (nearbyAgent) {
      let orderStatusUpdate;
      let agentStatusUpdate;

      if (nearbyAgent.permissions.canAcceptOrRejectOrders) {
        orderStatusUpdate = "pending_agent_acceptance";
        agentStatusUpdate = "Pending Acceptance";
      } else {
        orderStatusUpdate = "assigned_to_agent";
        agentStatusUpdate = "Assigned";
      }

      // Update Order
      await Order.findByIdAndUpdate(orderId, {
        assignedAgent: nearbyAgent._id,
        orderStatus: orderStatusUpdate,
      });

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
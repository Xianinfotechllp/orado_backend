  const Agent = require("../models/agentModel");
  const Order = require("../models/orderModel")
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

      // 1️⃣ Find the nearest available agent within the given distance
      const nearbyAgent = await Agent.findOne({
      
     // adjust this limit based on your capacity logic
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [longitude, latitude]
            },
            $maxDistance: maxDistance
          }
        }
      });

      // 2️⃣ If an agent is found — assign them to the order
      if (nearbyAgent) {
        await Order.findByIdAndUpdate(orderId, {
          assignedAgent: nearbyAgent._id,
          orderStatus: "assigned_to_agent"
        });

        // 3️⃣ Increment agent's order count
        await Agent.findByIdAndUpdate(nearbyAgent._id, {
          $inc: { currentOrderCount: 1 }
        });

        return nearbyAgent;
      }

      // 4️⃣ No agent found — return null
      return null;

    } catch (error) {
      console.error("Error in findAndAssignNearestAgent:", error);
      throw error; // Let the controller handle it
    }
  };
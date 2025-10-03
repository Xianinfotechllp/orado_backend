// utils/updateOrderETA.js

const Order = require("../models/orderModel");
const calculateETA = require("../utils/etaCalculator"); // adjust path

/**
 * Update order ETA dynamically based on status and agent location
 * @param {Object} params
 * @param {String} params.orderId - Order _id
 * @param {String} params.newStatus - New order status
 * @param {Array} [params.agentCoords] - Optional: agent current coordinates [longitude, latitude]
 * @param {Object} params.io - Socket.IO instance
 * @returns {Object} Updated order
 */
const updateOrderETA = async ({ orderId, newStatus, agentCoords = null, io }) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");

    // Update order status
    // order.orderStatus = newStatus;

    // Determine remaining preparation time
    let prepTimeRemaining = 0;
    if (newStatus === "preparing") {
      prepTimeRemaining = order.remainingPreparationMinutes || 15; // default prep time
    } else if (newStatus === "ready" || newStatus === "picked") {
      prepTimeRemaining = 0;
    }

    // Determine start coordinates
    const startCoords =
      agentCoords ||
      (newStatus === "picked" ? agentCoords : order.restaurantId.location.coordinates);

    const customerCoords = order.deliveryLocation.coordinates;

    // Recalculate ETA
    const { eta } = calculateETA(startCoords, customerCoords, prepTimeRemaining);

    order.eta = eta;
    await order.save();

    // Emit updated ETA via Socket.IO
    io.to(`user_${order.customerId}`).emit("eta_update", {
      orderId: order._id,
      etaAt: order.eta,
      orderStatus: order.orderStatus,
    });

    io.to(`restaurant_${order.restaurantId}`).emit("eta_update", {
      orderId: order._id,
      etaAt: order.eta,
      orderStatus: order.orderStatus,
    });

    if (agentCoords && order.agentId) {
      io.to(`agent_${order.agentId}`).emit("eta_update", {
        orderId: order._id,
        etaAt: order.eta,
        orderStatus: order.orderStatus,
      });
    }

    return order;
  } catch (error) {
    console.error("Error updating order ETA:", error);
    throw error;
  }
};

module.exports = updateOrderETA;

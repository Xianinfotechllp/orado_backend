const AgentMilestoneProgress = require("../models/agentMilestoneProgressModel");
const MilestoneReward = require("../models/MilestoneRewardModel");

/**
 * Service function to update agent milestone progress when an order is delivered
 * @param {ObjectId} agentId - The agent ID
 * @param {Object} orderData - Order data containing delivery information
 * @param {boolean} isOnTime - Whether the delivery was on time
 * @param {number} earnings - The earnings from this delivery
 */
const Order = require("../models/Order");
const Agent = require("../models/Agent");
const AgentEarning = require("../models/AgentEarning");
const MilestoneReward = require("../models/MilestoneReward");
const AgentMilestoneProgress = require("../models/AgentMilestoneProgress");
const { updateAgentMilestoneProgress } = require("../services/milestoneService");
const loyaltyService = require("../services/loyaltyService");
const { getDrivingDistance, findApplicableSurgeZones } = require("../utils/distance");
const geolib = require("geolib");

const deliveryFlow = [
  'awaiting_start', 'start_journey_to_restaurant', 'reached_restaurant',
  'picked_up', 'out_for_delivery', 'reached_customer', 'delivered', 'cancelled'
];

exports.updateAgentDeliveryStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const agentId = req.user._id;
    const { status } = req.body;
    const io = req.app.get("io");

    // Validate status
    if (!deliveryFlow.includes(status)) {
      return res.status(400).json({ message: "Invalid delivery status" });
    }

    // Fetch order
    const order = await Order.findById(orderId)
      .populate("customerId")
      .populate("restaurantId")
      .populate("orderItems.productId");

    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.assignedAgent?.toString() !== agentId.toString()) {
      return res.status(403).json({ message: "You are not assigned to this order" });
    }

    const previousStatus = order.agentDeliveryStatus;

    // Validate step transition
    const currentIndex = deliveryFlow.indexOf(previousStatus);
    const newIndex = deliveryFlow.indexOf(status);
    if (status !== "cancelled" && newIndex !== currentIndex + 1) {
      return res.status(400).json({
        message: `Invalid step transition: can't move from ${previousStatus} to ${status}`,
      });
    }

    // Update agent delivery status
    order.agentDeliveryStatus = status;

    // Map to customer status
    const mapForCustomer = (agentStatus) => {
      switch (agentStatus) {
        case "picked_up": return "picked_up";
        case "out_for_delivery":
        case "reached_customer": return "on_the_way";
        case "delivered": return "delivered";
        default: return null;
      }
    };

    const customerStatus = mapForCustomer(status);
    if (customerStatus) order.orderStatus = customerStatus;
    if (status === "delivered") order.deliveredAt = new Date();

    await order.save();

    // Socket notifications
    const relevantStatuses = ["picked_up", "out_for_delivery", "reached_customer", "delivered"];
    if (io && relevantStatuses.includes(status)) {
      const customerRoom = `user_${order.customerId._id.toString()}`;
      const adminRoom = `admin_group`;

      io.to(customerRoom).emit("order_status_update", {
        orderId: order._id,
        newStatus: order.orderStatus,
        previousStatus: mapForCustomer(previousStatus),
        timestamp: new Date(),
      });

      io.to(adminRoom).emit("order_status_update_admin", {
        orderId: order._id,
        newStatus: status,
        previousStatus,
        agentId,
        timestamp: new Date(),
      });

      if (status === "delivered") {
        io.to(customerRoom).emit("order_delivered", { orderId: order._id, timestamp: new Date() });
        io.to(adminRoom).emit("order_delivered_admin", { orderId: order._id, agentId, timestamp: new Date() });
      }
    }

    // Handle delivered: agent availability, loyalty points, earnings
    if (status === "delivered") {
      await Agent.updateOne(
        { _id: agentId },
        { $set: { "agentStatus.status": "AVAILABLE", "agentStatus.availabilityStatus": "AVAILABLE" } }
      );

      // Award loyalty points
      try {
        await loyaltyService.awardPoints(order.customerId._id, order._id, order.subtotal);
      } catch (err) {
        console.error("Failed to award loyalty points:", err.message);
      }

      // Create agent earning if not exists
      const existingEarning = await AgentEarning.findOne({ agentId, orderId });
      if (!existingEarning) {
        const earningsConfig = await AgentEarningSettings.findOne({ mode: "global" });
        if (!earningsConfig) return res.status(500).json({ message: "Earnings configuration not found." });

        let distanceKm = 0;
        if (
          Array.isArray(order.restaurantId?.location?.coordinates) &&
          Array.isArray(order.deliveryLocation?.coordinates)
        ) {
          const fromCoords = order.restaurantId.location.coordinates;
          const toCoords = order.deliveryLocation.coordinates;
          const drivingDistance = await getDrivingDistance(fromCoords, toCoords);
          distanceKm = drivingDistance ?? geolib.getDistance(
            { latitude: fromCoords[1], longitude: fromCoords[0] },
            { latitude: toCoords[1], longitude: toCoords[0] }
          ) / 1000;
        }

        let surgeZones = [];
        try {
          surgeZones = await findApplicableSurgeZones({
            fromCoords: order.restaurantId.location.coordinates,
            toCoords: order.deliveryLocation.coordinates,
            time: new Date(),
          });
        } catch (err) {
          console.warn("Failed to fetch surge zones:", err.message);
        }

        await createAgentEarning({
          agentId,
          orderId,
          earningsConfig: earningsConfig.toObject(),
          surgeZones,
          incentiveBonuses: { peakHourBonus: 0, rainBonus: 0 },
          distanceKm,
        });

        await createAgentIncentive({ agentId });
      }

      // ✅ Update Milestone Progress
      const isOnTime = order.deliveredAt && order.etaAt
        ? order.deliveredAt <= order.etaAt
        : false;
      const earnings = order.totalAmount || 0;

      await updateAgentMilestoneProgress(agentId, order, isOnTime, earnings);
    }

    res.status(200).json({ message: "Delivery status updated", order });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
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
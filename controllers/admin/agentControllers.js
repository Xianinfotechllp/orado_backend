const Agent = require("../../models/agentModel");
const Order = require("../../models/orderModel")
exports.getAllAgents = async (req, res) => {
  try {
    const agents = await Agent.find().select(
      "fullName phoneNumber agentStatus.status agentStatus.availabilityStatus location"
    );

    const formattedAgents = agents.map((agent) => {
      let derivedStatus = 'Inactive';

      if (agent.agentStatus.status === 'AVAILABLE') {
        derivedStatus = 'Free';
      } else if (
        [
          'ORDER_ASSIGNED',
          'ORDER_ACCEPTED',
          'ARRIVED_AT_RESTAURANT',
          'PICKED_UP',
          'ON_THE_WAY',
          'AT_CUSTOMER_LOCATION'
        ].includes(agent.agentStatus.status)
      ) {
        derivedStatus = 'Busy';
      }

      const coordinates = agent.location?.coordinates || [0, 0];
      const accuracy = agent.location?.accuracy || 0;

      return {
        id: agent._id,
        name: agent.fullName,
        phone: agent.phoneNumber,
        status: derivedStatus,
        currentStatus: agent.agentStatus.status,
        location: {
          lat: coordinates[1],
          lng: coordinates[0],
          accuracy: accuracy,
        },
      };
    });

    res.status(200).json({
      messageType: 'success',
      data: formattedAgents,
    });

  } catch (error) {
    console.error('Error fetching agent list:', error);
    res.status(500).json({
      messageType: 'failure',
      message: 'Failed to fetch agents',
    });
  }
};



exports.manualAssignAgent = async (req, res) => {
  try {
    const { orderId, agentId } = req.body;

    // 1. Fetch the order
    const order = await Order.findById(orderId)
      .populate({
        path: 'customerId',
        select: 'name phone email',
      })
      .populate({
        path: 'restaurantId',
        select: 'name address location',
      });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (["completed", "delivered", "cancelled_by_customer"].includes(order.orderStatus)) {
      return res.status(400).json({ message: "Order already completed or invalid for assignment." });
    }

    // 2. Fetch agent
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found." });
    }

    // ✅ We allow admin to assign even if agent is not "AVAILABLE", but can warn
    if (agent.agentStatus?.status !== "AVAILABLE") {
      console.warn("Warning: Assigning to an agent who is not marked AVAILABLE.");
    }

    // 3. Update order
    order.assignedAgent = agentId;
    order.agentAssignmentStatus = "manually_assigned_by_admin";
    order.agentAssignmentTimestamp = new Date();
    await order.save();

    // 4. Update agent deliveryStatus
    if (!agent.deliveryStatus) {
      agent.deliveryStatus = {
        currentOrderId: [],
        currentOrderCount: 0,
        status: "ORDER_ASSIGNED"
      };
    }

    if (!agent.deliveryStatus.currentOrderId.includes(order._id)) {
      agent.deliveryStatus.currentOrderId.push(order._id);
      agent.deliveryStatus.currentOrderCount += 1;
    }

    agent.agentStatus.status = "ORDER_ASSIGNED";
    agent.lastAssignedAt = new Date();
    agent.lastManualAssignmentAt = new Date();
    agent.lastAssignmentType = "manual";

    // 5. Update agent assignment history
    if (!Array.isArray(agent.agentAssignmentStatusHistory)) {
      agent.agentAssignmentStatusHistory = [];
    }

    agent.agentAssignmentStatus = "manually_assigned_by_admin";
    agent.agentAssignmentStatusHistory.push({
      status: "manually_assigned_by_admin",
      changedAt: new Date(),
    });

    await agent.save();

    // 6. Emit via Socket.IO
    const io = req.app.get("io");

    const payload = {
      status: "success",
      assignedOrders: [
        {
          id: order._id,
          status: order.orderStatus,
          totalPrice: order.totalPrice,
          deliveryAddress: order.deliveryAddress,
          deliveryLocation: {
            lat: order.deliveryLocation?.coordinates?.[1] || 0,
            long: order.deliveryLocation?.coordinates?.[0] || 0,
          },
          createdAt: order.createdAt,
          paymentMethod: order.paymentMethod,
          items: order.items || [],
          customer: {
            name: order.customerId?.name || "",
            phone: order.customerId?.phone || "",
            email: order.customerId?.email || "",
          },
          restaurant: {
            name: order.restaurantId?.name || "",
            address: order.restaurantId?.address || "",
            location: {
              lat: order.restaurantId?.location?.coordinates?.[1] || 0,
              long: order.restaurantId?.location?.coordinates?.[0] || 0,
            },
          },
        },
      ],
    };

    io.to(`agent_${agent._id}`).emit("orderAssigned", payload);
    console.log("📦 Order assigned and emitted to agent:", agent._id);

    // 7. Response
    res.status(200).json({
      message: "Agent manually assigned successfully.",
      order,
      agent,
    });

  } catch (error) {
    console.error("❌ Manual assignment error:", error);
    res.status(500).json({
      message: "Internal server error.",
      error: error.message,
    });
  }
};






exports.saveFcmToken = async (req, res) => {
  try {
    const { agentId, fcmToken } = req.body;

    if (!agentId || !fcmToken) {
      return res.status(400).json({ message: "Missing agentId or fcmToken" });
    }

    // Update only if token is not already stored
    await Agent.findByIdAndUpdate(agentId, {
      $addToSet: {
        fcmTokens: { token: fcmToken, updatedAt: new Date() },
      },
    });

    res.status(200).json({ message: "FCM token saved successfully" });
  } catch (err) {
    console.error("Error saving FCM token:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};




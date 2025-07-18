const Agent = require("../../models/agentModel");
const Order = require("../../models/orderModel")
exports.getAllAgents = async (req, res) => {
  try {
    const agents = await Agent.find().select(
      "fullName phoneNumber agentStatus.status agentStatus.availabilityStatus"
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
      

      return {
        id: agent._id,
        name: agent.fullName,
        phone: agent.phoneNumber,
        status: derivedStatus, // Free / Busy / Inactive
        currentStatus: agent.agentStatus.status,
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

    // Validate order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    // Check if order is already assigned or completed
    if (
      ["completed", "delivered", "cancelled_by_customer"].includes(order.orderStatus)
    ) {
      return res.status(400).json({
        message: "Order already completed or invalid for assignment.",
      });
    }

    // Validate agent
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found." });
    }

    // Check if agent is AVAILABLE
    if (agent.agentStatus.status !== "AVAILABLE") {
      return res
        .status(400)
        .json({ message: "Agent is not currently available for new orders." });
    }

    // Assign agent to order
    order.assignedAgent = agentId;
    order.agentAssignmentStatus = "assigned";
    await order.save();

    // Update agent status and assign order
    agent.deliveryStatus.currentOrderId.push(order._id);
    agent.deliveryStatus.currentOrderCount += 1;

    agent.agentStatus.status = "ORDER_ASSIGNED";
    agent.lastAssignedAt = new Date();

    await agent.save();

const io = req.app.get("io"); // or import it from your socket file
io.to(`agent_${agent._id}`).emit("orderAssigned", {
  orderId: order._id,
  message: "New order assigned to you.",
  orderDetails: order,
});

    res.status(200).json({
      message: "Agent assigned successfully.",
      order,
      agent,
    });
  } catch (error) {
    console.error("Manual assignment error:", error);
    res.status(500).json({
      message: "Internal server error.",
      error: error.message,
    });
  }
};



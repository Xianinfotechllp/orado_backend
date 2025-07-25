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

    // Fetch order with customer & restaurant info
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

    // Ensure order is valid for assignment
    if (["completed", "delivered", "cancelled_by_customer"].includes(order.orderStatus)) {
      return res.status(400).json({ message: "Order already completed or invalid for assignment." });
    }

    const agent = await Agent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found." });
    }

    if (agent.agentStatus.status !== "AVAILABLE") {
      return res.status(400).json({ message: "Agent is not currently available for new orders." });
    }

    // Assign order
    order.assignedAgent = agentId;
    order.agentAssignmentStatus = "assigned";
    await order.save();

    // Update agent info
    agent.deliveryStatus.currentOrderId.push(order._id);
    agent.deliveryStatus.currentOrderCount += 1;
    agent.agentStatus.status = "ORDER_ASSIGNED";
    agent.lastAssignedAt = new Date();
    await agent.save();

    // Prepare Socket payload
    const io = req.app.get("io");

    const payload = {
      status: "success",
      assignedOrders: [
        {
          id: order._id,
          status: order.orderStatus,
          totalPrice: order.totalPrice,
          deliveryAddress: order.deliveryAddress,
          deliveryLocation:order.deliveryLocation,
          createdAt: order.createdAt,
          paymentMethod: order.paymentMethod,
          items: order.items || [], // Assuming it's an array of products with name, qty, price
          customer: {
            name: order.customerId?.name || "",
            phone: order.customerId?.phone || "",
            email:order.customerId?.email || ""
          },
          restaurant: {
            name: order.restaurantId?.name || "",
            address: order.restaurantId?.address || "",
            location: order.restaurantId?.location || null,
          },
        },
      ],
    };

    io.to(`agent_${agent._id}`).emit("orderAssigned", payload);

    console.log("Socket sent to", `agent_${agent._id}`, payload);

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


exports.giveWarning = async (req, res) => {
  const adminId = req.user._id;
  const { agentId } = req.params;
  const { reason } = req.body;

  if (!reason) return res.status(400).json({ message: "Reason is required" });

  const agent = await Agent.findById(agentId);
  if (!agent) return res.status(404).json({ message: "Agent not found." });

  agent.warnings.push({ reason, issuedBy: adminId });
  await agent.save();

  return res.json({ message: "Warning issued.", agent });
};


exports.terminateAgent = async (req, res) => {
  const adminId = req.user._id;
  const { agentId } = req.params;
  const { reason, letter } = req.body;

  const agent = await Agent.findById(agentId);
  if (!agent) return res.status(404).json({ message: "Agent not found." });

  // Set termination
  agent.termination = {
    terminated: true,
    terminatedAt: new Date(),
    issuedBy: adminId,
    reason,
    letter,
  };
  await agent.save();

  // Change user's role to "customer"
  await User.findByIdAndUpdate(agent.userId, {
    userType: "customer",
    isAgent: false,
    agentApplicationStatus: "rejected"
  });

  return res.json({ message: "Agent terminated.", agent });
};


// Get pending leave requests

exports.getAllLeaveRequests = async (req, res) => {
  try {
    const statusFilter = req.query.status || "Pending";

    const agents = await Agent.aggregate([
      { $unwind: "$leaves" },
      { $match: { "leaves.status": statusFilter } },
      {
        $project: {
          _id: 1,
          fullName: 1,
          leaves: 1,
        },
      },
    ]);
    res.status(200).json(agents);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// Approve or reject leave request

exports.processLeave = async (req, res) => {
  try {
    const { agentId, leaveId } = req.params;
    const { decision, rejectionReason } = req.body; 
    const adminId = req.user._id; 

    if (!["Approved", "Rejected"].includes(decision))
      return res.status(400).json({ message: "Invalid decision" });

    const agent = await Agent.findById(agentId);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    const leave = agent.leaves.id(leaveId);
    if (!leave) return res.status(404).json({ message: "Leave request not found" });

    leave.status = decision;
    leave.reviewedBy = adminId;
    leave.reviewedAt = new Date();
    if (decision === "Rejected") leave.rejectionReason = rejectionReason;

    await agent.save();
    res.status(200).json({ message: `Leave has been ${decision}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
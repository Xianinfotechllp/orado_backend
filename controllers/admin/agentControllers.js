const Agent = require("../../models/agentModel");
const Order = require("../../models/orderModel")
const User = require("../../models/userModel");
const AgentSelfie = require("../../models/AgentSelfieModel");
const AgentNotification = require('../../models/AgentNotificationModel');
const admin = require('../../config/firebaseAdmin'); 
const sendNotificationToAgent = require('../../utils/sendNotificationToAgent')
exports.getAllList = async (req, res) => {
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


exports.giveWarning = async (req, res) => {
  const adminId = req.user._id;
  const { agentId } = req.params;
  const { reason } = req.body;

  if (!reason) return res.status(400).json({ message: "Reason is required" });

  const agent = await Agent.findById(agentId);
  if (!agent) return res.status(404).json({ message: "Agent not found." });

  agent.warnings.push({ reason, issuedBy: adminId });
  await agent.save();

    await sendNotificationToAgent({
    agentId,
    title: "Warning Issued",
    body: `Reason: ${reason}`,
    data: { type: "warning", reason },
  });

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
  await sendNotificationToAgent({
    agentId,
    title: "Account Terminated",
    body: `You have been terminated. Reason: ${reason}`,
    data: { type: "termination", reason },
  });

  return res.json({ message: "Agent terminated.", agent });
};







exports.saveFcmToken = async (req, res) => {
  try {
    const { agentId, fcmToken } = req.body;
    console.log("Saving FCM token for agent:", agentId, "Token:", fcmToken);

    if (!agentId || !fcmToken) {
      return res.status(400).json({ message: "Missing agentId or fcmToken" });
    }

    // 1. Remove token from all other agents (optional, to enforce one-token-per-device)
    await Agent.updateMany(
      { _id: { $ne: agentId } },
      { $pull: { fcmTokens: { token: fcmToken } } }
    );

    // 2. Load current agent
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    // 3. Remove duplicate tokens within the same agent
    agent.fcmTokens = agent.fcmTokens.filter(t => t.token !== fcmToken);

    // 4. Add fresh token
    agent.fcmTokens.push({ token: fcmToken, updatedAt: new Date() });

    // 5. Save agent
    await agent.save();

    res.status(200).json({ message: "FCM token saved successfully" });
  } catch (err) {
    console.error("Error saving FCM token:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};






exports.sendNotificationToAgent = async (req, res) => {
  try {
    const { agentId, title, body, data = {} } = req.body;

    const agent = await Agent.findById(agentId);
    if (!agent || !agent.fcmTokens || agent.fcmTokens.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No FCM tokens found for this agent',
      });
    }

    const messages = agent.fcmTokens.map(tokenObj => ({
      token: tokenObj.token,
      notification: { title, body },
      data: {
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        ...data,
      },
    }));

    const responses = await Promise.allSettled(
      messages.map(msg => admin.messaging().send(msg))
    );

    await AgentNotification.create({
      agentId,
      title,
      body,
      data,
    });

    res.json({
      success: true,
      message: 'Notification sent and saved',
      results: responses,
    });
  } catch (error) {
    console.error('❌ Error sending agent notification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};















exports.sendNotificationToAgent = async (req, res) => {
  try {
    const { agentId, title, body, data = {} } = req.body;

    const agent = await Agent.findById(agentId);
    if (!agent || !agent.fcmTokens || agent.fcmTokens.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No FCM tokens found for this agent',
      });
    }

    const messages = agent.fcmTokens.map(tokenObj => ({
      token: tokenObj.token,
      notification: { title, body },
      data: {
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        ...data,
      },
    }));

    const responses = await Promise.allSettled(
      messages.map(msg => admin.messaging().send(msg))
    );

    await AgentNotification.create({
      agentId,
      title,
      body,
      data,
    });

    res.json({
      success: true,
      message: 'Notification sent and saved',
      results: responses,
    });
  } catch (error) {
    console.error('❌ Error sending agent notification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};













exports.sendNotificationToAgent = async (req, res) => {
  try {
    const { agentId, title, body, data = {} } = req.body;

    const agent = await Agent.findById(agentId);
    if (!agent || !agent.fcmTokens || agent.fcmTokens.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No FCM tokens found for this agent',
      });
    }

    const messages = agent.fcmTokens.map(tokenObj => ({
      token: tokenObj.token,
      notification: { title, body },
      data: {
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        ...data,
      },
    }));

    const responses = await Promise.allSettled(
      messages.map(msg => admin.messaging().send(msg))
    );

    await AgentNotification.create({
      agentId,
      title,
      body,
      data,
    });

    res.json({
      success: true,
      message: 'Notification sent and saved',
      results: responses,
    });
  } catch (error) {
    console.error('❌ Error sending agent notification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};






exports.saveFcmToken = async (req, res) => {
  try {
    const { agentId, fcmToken } = req.body;
    console.log("Saving FCM token for agent:", agentId, "Token:", fcmToken);

    if (!agentId || !fcmToken) {
      return res.status(400).json({ message: "Missing agentId or fcmToken" });
    }

    const agent = await Agent.findById(agentId);

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    const existingToken = agent.fcmTokens.find(t => t.token === fcmToken);

    if (existingToken) {
      // Update existing token timestamp
      existingToken.updatedAt = new Date();
    } else {
      // Add new token
      agent.fcmTokens.push({ token: fcmToken, updatedAt: new Date() });
    }

    await agent.save();

    res.status(200).json({ message: "FCM token saved successfully" });
  } catch (err) {
    console.error("Error saving FCM token:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};







exports.sendNotificationToAgent = async (req, res) => {
  try {
    const { agentId, title, body, data = {} } = req.body;

    const agent = await Agent.findById(agentId);
    if (!agent || !agent.fcmTokens || agent.fcmTokens.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No FCM tokens found for this agent',
      });
    }

    const messages = agent.fcmTokens.map(tokenObj => ({
      token: tokenObj.token,
      notification: { title, body },
      data: {
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        ...data,
      },
    }));

    const responses = await Promise.allSettled(
      messages.map(msg => admin.messaging().send(msg))
    );

    await AgentNotification.create({
      agentId,
      title,
      body,
      data,
    });

    res.json({
      success: true,
      message: 'Notification sent and saved',
      results: responses,
    });
  } catch (error) {
    console.error('❌ Error sending agent notification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get pending leave requests

exports.getAllLeaveRequests = async (req, res) => {
  try {
    const statusFilter = req.query.status || "all"; // Default to "all"
    
    let matchStage = {};
    if (statusFilter !== "all") {
      matchStage = { "leaves.status": statusFilter };
    }

    const agents = await Agent.aggregate([
      { $unwind: "$leaves" },
      ...(statusFilter !== "all" ? [{ $match: matchStage }] : []),
      {
        $project: {
          _id: 1,
          fullName: 1,
          leaves: 1,
        },  
      },
      { $sort: { "leaves.appliedAt": -1 } } // Optional: sort by application date
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

    // ✅ Send notification
    await sendNotificationToAgent({
      agentId: agent._id,
      title: decision === "Approved" ? "✅ Leave Approved" : "❌ Leave Rejected",
      body: decision === "Approved"
        ? `Your leave request (${new Date(leave.leaveStartDate).toLocaleDateString()} - ${new Date(leave.leaveEndDate).toLocaleDateString()}) has been approved.`
        : `Your leave request has been rejected.${rejectionReason ? " Reason: " + rejectionReason : ""}`,
      data: {
        type: "leave_update",
        leaveId: leave._id.toString(),
        status: decision
      }
    });

    res.status(200).json({ message: `Leave has been ${decision}` });
  } catch (err) {
    console.error("Error processing leave:", err);
    res.status(500).json({ message: err.message });
  }
};







exports.getPendingApplications = async (req, res) => {
  try {
    const pendingAgents = await Agent.find({ applicationStatus: "pending" })
      .select("-password -fcmTokens -bankAccountDetails")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Pending agent applications retrieved",
      count: pendingAgents.length,
      agents: pendingAgents,
    });
  } catch (error) {
    console.error("Error fetching pending applications:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


exports.approveApplication = async (req, res) => {
  try {
    const { agentId } = req.params;

    // Find and update the agent
    const agent = await Agent.findByIdAndUpdate(
      agentId,
      { 
        applicationStatus: 'approved',
        approvedAt: new Date(),
        approvedBy: req.user._id // Track who approved it
      },
      { new: true }
    ).select("-password -fcmTokens -bankAccountDetails");

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    // Here you might want to:
    // 1. Send approval notification email
    // 2. Create user credentials if needed
    // 3. Trigger any onboarding processes

    return res.status(200).json({
      message: "Agent application approved successfully",
      agent
    });

  } catch (error) {
    console.error("Error approving application:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


exports.rejectApplication = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { rejectionReason } = req.body; // Optional rejection reason

    if (!rejectionReason) {
      return res.status(400).json({ message: "Rejection reason is required" });
    }

    const agent = await Agent.findByIdAndUpdate(
      agentId,
      { 
        applicationStatus: 'rejected',
        rejectedAt: new Date(),
        rejectedBy: req.user._id,
        rejectionReason
      },
      { new: true }
    ).select("-password -fcmTokens -bankAccountDetails");

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    // Here you might want to:
    // 1. Send rejection notification email with reason
    // 2. Log the rejection for records

    return res.status(200).json({
      message: "Agent application rejected successfully",
      agent
    });

  } catch (error) {
    console.error("Error rejecting application:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};




exports.getAllAgents = async (req, res) => {
  try {


    // Get query parameters for filtering
    const { status, search } = req.query;
    
    // Build the query object
    let query = {};
    
    // Add status filter if provided
    if (status && status !== 'all') {
      query.applicationStatus = status;
    }
    
    // Add search filter if provided
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Get all agents with filtering
    const agents = await Agent.find(query)
      .select("-password -fcmTokens -bankAccountDetails")
      .sort({ createdAt: -1 })
      .lean();

    // Format the response data
    // Format the response data
const formattedAgents = agents.map(agent => ({
  id: agent._id,
  name: agent.fullName,  // This is correct as per schema
  phone: agent.phoneNumber,  // Changed from phone to phoneNumber
  email: agent.email,
  status: agent.applicationStatus || 'pending',
  documents: {
    license: agent.agentApplicationDocuments?.license || null,
    insurance: agent.agentApplicationDocuments?.insurance || null,
    rcBook: agent.agentApplicationDocuments?.rcBook || null,
    pollutionCertificate: agent.agentApplicationDocuments?.pollutionCertificate || null,
    submittedAt: agent.agentApplicationDocuments?.submittedAt || null
  },
  createdAt: agent.createdAt,
  updatedAt: agent.updatedAt,
  approvedAt: agent.approvedAt,
  rejectedAt: agent.rejectedAt,
  approvedBy: agent.approvedBy,
  rejectedBy: agent.rejectedBy,
  rejectionReason: agent.rejectionReason
}));

    return res.status(200).json({
      message: "Agents retrieved successfully",
      count: formattedAgents.length,
      agents: formattedAgents,
    });
  } catch (error) {
    console.error("Error fetching agents:", error);
    return res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
  }
};













// Get all selfies with pagination and filtering
exports.getAgentSelfies = async (req, res) => {
  try {
    const { page = 1, limit = 10, agentId, startDate, endDate } = req.query;
    
    // Build query
    const query = {};
    
    if (agentId && mongoose.Types.ObjectId.isValid(agentId)) {
      query.agentId = agentId;
    }
    
    if (startDate || endDate) {
      query.takenAt = {};
      if (startDate) query.takenAt.$gte = new Date(startDate);
      if (endDate) query.takenAt.$lte = new Date(endDate);
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { takenAt: -1 },
      populate: {
        path: 'agentId',
        select: 'fullName email phoneNumber' // Customize fields you want from Agent
      }
    };

    const result = await AgentSelfie.paginate(query, options);

    res.json({
      success: true,
      selfies: result.docs,
      total: result.totalDocs,
      pages: result.totalPages,
      currentPage: result.page
    });

  } catch (error) {
    console.error('Error fetching selfie logs:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch selfie logs' 
    });
  }
};

// Get single selfie with details
exports.getSelfieDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const selfie = await AgentSelfie.findById(id)
      .populate('agentId', 'name email phone');

    if (!selfie) {
      return res.status(404).json({ 
        success: false,
        error: 'Selfie not found' 
      });
    }

    res.json({
      success: true,
      selfie
    });

  } catch (error) {
    console.error('Error fetching selfie details:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch selfie details' 
    });
  }
};

// Get selfies by specific agent
exports.getAgentSelfieHistory = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { limit = 30 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid agent ID' 
      });
    }

    const selfies = await AgentSelfie.find({ agentId })
      .sort({ takenAt: -1 })
      .limit(parseInt(limit))
      .populate('agentId', 'name');

    res.json({
      success: true,
      count: selfies.length,
      selfies
    });

  } catch (error) {
    console.error('Error fetching agent selfie history:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch agent selfie history' 
    });
  }
};
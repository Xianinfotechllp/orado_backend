const Agent = require("../../models/agentModel");
const Order = require("../../models/orderModel")
const User = require("../../models/userModel");
const AgentSelfie = require("../../models/AgentSelfieModel");
const AgentNotification = require('../../models/AgentNotificationModel');
const admin = require('../../config/firebaseAdmin'); 
const sendNotificationToAgent = require('../../utils/sendNotificationToAgent')
const AgentDeviceInfo = require("../../models/AgentDeviceInfoModel")

const  getRedisClient  = require("../../config/redisClient");
const redis = getRedisClient();


exports.getAllList = async (req, res) => {
  try {
    // First get all agents with basic info
    const agents = await Agent.find()
      .select("fullName phoneNumber agentStatus.status agentStatus.availabilityStatus location")
      .lean(); // Convert to plain JS objects

    // Get all device info in one query for efficiency
    const deviceInfos = await AgentDeviceInfo.find({
      agent: { $in: agents.map(a => a._id) }
    }).lean();

    // Create a map of agentId -> deviceInfo for quick lookup
    const deviceInfoMap = deviceInfos.reduce((map, info) => {
      map[info.agent.toString()] = {
        os: info.os,
        osVersion: info.osVersion,
        appVersion: info.appVersion,
        model: info.model,
        batteryLevel: info.batteryLevel,
        networkType: info.networkType,
        timezone: info.timezone,
        locationEnabled: info.locationEnabled,
        isRooted: info.isRooted,
        updatedAt: info.updatedAt
      };
      return map;
    }, {});

    // Format the final response
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
        deviceInfo: deviceInfoMap[agent._id.toString()] || null
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






exports.getAllListStatus = async (req, res) => {
  try {
    // Fetch all agents
    const agents = await Agent.find()
      .select(
        "fullName phoneNumber agentStatus location currentOrder lastStatusUpdate profilePicture"
      )
      .lean();

    // Fetch device info for all agents
    const deviceInfos = await AgentDeviceInfo.find({
      agent: { $in: agents.map((a) => a._id) },
    }).lean();

    // Map agentId -> device info
    const deviceInfoMap = deviceInfos.reduce((map, info) => {
      map[info.agent.toString()] = {
        os: info.os,
        osVersion: info.osVersion,
        appVersion: info.appVersion,
        model: info.model,
        batteryLevel: info.batteryLevel,
        networkType: info.networkType,
        timezone: info.timezone,
        locationEnabled: info.locationEnabled,
        isRooted: info.isRooted,
        updatedAt: info.updatedAt,
      };
      return map;
    }, {});

    // Build final response with Redis fallback for location
    const responseData = await Promise.all(
      agents.map(async (agent) => {
        let coordinates = [0, 0];
        let accuracy = 0;

        // Try Redis first
        const redisLoc = await redis.get(`agent_location:${agent._id}`);
        if (redisLoc) {
          const parsed = JSON.parse(redisLoc);
          coordinates = [parsed.lat, parsed.lng];
          accuracy = parsed.accuracy || 0;
          console.log(`Agent ${agent._id} location fetched from Redis:`, coordinates);
        } else if (agent.location?.coordinates) {
          // Fallback to DB location
          coordinates = agent.location.coordinates;
          accuracy = agent.location.accuracy || 0;
          console.log(`Agent ${agent._id} location fetched from DB:`, coordinates);
        } else {
          console.log(`Agent ${agent._id} has no location data.`);
        }

        return {
          _id: agent._id,
          fullName: agent.fullName,
          phoneNumber: agent.phoneNumber,
          profilePicture: agent.profilePicture,
          agentStatus: {
            status: agent.agentStatus?.status || "OFFLINE",
            availabilityStatus: agent.agentStatus?.availabilityStatus || "UNAVAILABLE",
          },
          location: {
            type: agent.location?.type || "Point",
            coordinates,
            accuracy,
          },
          deviceInfo: deviceInfoMap[agent._id.toString()] || null,
          currentOrder: agent.currentOrder || null,
          lastStatusUpdate: agent.lastStatusUpdate,
        };
      })
    );

    res.status(200).json({
      messageType: "success",
      data: responseData,
    });
  } catch (error) {
    console.error("Error fetching agent list:", error);
    res.status(500).json({
      messageType: "failure",
      message: "Failed to fetch agents",
    });
  }
};











exports.manualAssignAgent = async (req, res) => {
  try {
    const { orderId, agentId } = req.body;
    console.log(req.body)
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


    const io = req.app.get("io"); // or however you're accessing the Socket instance
    console.log(`user_${order.customerId.toString()}`)
    io.to(`user_${order.customerId._id.toString()}`).emit("agentAssigned", {
      orderId: order._id,
      agent: {
        agentId:agent._id,
        fullName: agent.fullName,
        phoneNumber: agent.phoneNumber,
      },
    });

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


const restaurantName = order.restaurantId?.name || "a restaurant";
const customerName = order.customerId?.name || "a customer";
const deliveryAddress = order.deliveryAddress?.street || "an address";
const notificationTitle = `New Order Assignment`;
const notificationBody = `You've been assigned to deliver from ${restaurantName} to ${deliveryAddress}. Order total: ₹${order.totalAmount || 0}`;

   await sendNotificationToAgent({
    agentId,
    title: notificationTitle,
    body: notificationBody,
  data: { 
  },
  });

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
  try {
    console.log(req.body);

    const { agentId } = req.params;
    const { reason, severity = "minor" } = req.body;

    if (!reason) {
      return res.status(400).json({ message: "Reason is required" });
    }

    // Validate severity
    const validSeverities = ["minor", "major", "critical"];
    if (!validSeverities.includes(severity)) {
      return res.status(400).json({ message: "Invalid severity value" });
    }

    const agent = await Agent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found." });
    }

    // Add warning
    agent.warnings.push({ reason, severity });
    await agent.save();

    // Send notification
    await sendNotificationToAgent({
      agentId,
      title: "Warning Issued",
      body: `Reason: ${reason} | Severity: ${severity}`,
      data: { type: "warning", reason, severity },
    });

    return res.json({ message: "Warning issued.", agent });
  } catch (error) {
    console.error("Error issuing warning:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
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






// exports.sendNotificationToAgent = async (req, res) => {
//   try {
//     const { agentId, title, body, data = {} } = req.body;

//     const agent = await Agent.findById(agentId);
//     if (!agent || !agent.fcmTokens || agent.fcmTokens.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: 'No FCM tokens found for this agent',
//       });
//     }

//     const messages = agent.fcmTokens.map(tokenObj => ({
//       token: tokenObj.token,
//       notification: { title, body },
//       data: {
//         click_action: 'FLUTTER_NOTIFICATION_CLICK',
//         ...data,
//       },
//     }));

//     const responses = await Promise.allSettled(
//       messages.map(msg => admin.messaging().send(msg))
//     );

//     await AgentNotification.create({
//       agentId,
//       title,
//       body,
//       data,
//     });

//     res.json({
//       success: true,
//       message: 'Notification sent and saved',
//       results: responses,
//     });
//   } catch (error) {
//     console.error('❌ Error sending agent notification:', error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };















// exports.sendNotificationToAgent = async (req, res) => {
//   try {
//     const { agentId, title, body, data = {} } = req.body;

//     const agent = await Agent.findById(agentId);
//     if (!agent || !agent.fcmTokens || agent.fcmTokens.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: 'No FCM tokens found for this agent',
//       });
//     }

//     const messages = agent.fcmTokens.map(tokenObj => ({
//       token: tokenObj.token,
//       notification: { title, body },
//       data: {
//         click_action: 'FLUTTER_NOTIFICATION_CLICK',
//         ...data,
//       },
//     }));

//     const responses = await Promise.allSettled(
//       messages.map(msg => admin.messaging().send(msg))
//     );

//     await AgentNotification.create({
//       agentId,
//       title,
//       body,
//       data,
//     });

//     res.json({
//       success: true,
//       message: 'Notification sent and saved',
//       results: responses,
//     });
//   } catch (error) {
//     console.error('❌ Error sending agent notification:', error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };













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
    const { status, search } = req.query;

    let query = {};
    if (status && status !== 'all') {
      query.applicationStatus = status;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const agents = await Agent.find(query)
      .select("-password -fcmTokens -bankAccountDetails")
      .sort({ createdAt: -1 })
      .lean();

    const formattedAgents = agents.map(agent => ({
      id: agent._id,
      name: agent.fullName,
      phone: agent.phoneNumber,
      email: agent.email,
      status: agent.applicationStatus || 'pending',
      documents: {
        license: agent.agentApplicationDocuments?.license || null,
        insurance: agent.agentApplicationDocuments?.insurance || null,
        rcBook: agent.agentApplicationDocuments?.rcBook || null,
        pollutionCertificate: agent.agentApplicationDocuments?.pollutionCertificate || null,
        submittedAt: agent.agentApplicationDocuments?.submittedAt || null
      },
      warnings: agent.warnings?.map(w => ({
        reason: w.reason,
        severity: w.severity, 
        issuedBy: w.issuedBy ? {
          id: w.issuedBy._id,
          name: w.issuedBy.fullName,
          email: w.issuedBy.email
        } : null,
        issuedAt: w.issuedAt
      })) || [],
      termination: {
        terminated: agent.termination?.terminated || false,
        terminatedAt: agent.termination?.terminatedAt || null,
        reason: agent.termination?.reason || null,
        letter: agent.termination?.letter || null,
        issuedBy: agent.termination?.issuedBy ? {
          id: agent.termination.issuedBy._id,
          name: agent.termination.issuedBy.fullName,
          email: agent.termination.issuedBy.email
        } : null
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

exports.reviewAgentSelfie = async (req, res) => {
  
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review action. Use "approve" or "reject".',
      });
    }

    const selfie = await AgentSelfie.findById(id);
    if (!selfie) {
      return res.status(404).json({ success: false, message: 'Selfie not found.' });
    }
    if (selfie.status !== 'pending') {
      return res.status(409).json({ success: false, message: 'Selfie already reviewed.' });
    }

    selfie.status = action === 'approve' ? 'approved' : 'rejected';
    selfie.reviewedAt = new Date();
    selfie.reviewedBy =  req.user._id; 
    if (action === 'reject') {
      selfie.rejectionReason = rejectionReason || 'No reason provided';
    }

    await selfie.save();

    await sendNotificationToAgent({
      agentId: selfie.agentId,
      title: selfie.status === 'approved' ? 'Selfie Approved' : 'Selfie Rejected',
      body: selfie.status === 'approved'
        ? 'Your selfie has been approved by admin. Thank you!'
        : `Your selfie was rejected. Reason: ${selfie.rejectionReason || 'No reason provided'}`,
      data: {
        selfieId: selfie._id.toString(),
        status: selfie.status
      }
    });

    return res.json({
      success: true,
      message: `Selfie has been ${selfie.status}.`,
      data: {
        id: selfie._id,
        agentId: selfie.agentId,
        status: selfie.status,
        reviewedAt: selfie.reviewedAt,
        rejectionReason: selfie.rejectionReason,
      }
    });
  } catch (err) {
    console.error('Review selfie error', err);
    return res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
};



// controllers/adminAgentController.js
exports.getAgentCODSummary = async (req, res) => {
  try {
    const agents = await Agent.find({})
      .select("fullName phoneNumber email codTracking codSubmissionLogs permissions")
      .sort({ "codTracking.currentCODHolding": -1 });

    const agentSummaries = agents.map(agent => {
      const latestDrop = agent.codSubmissionLogs?.[agent.codSubmissionLogs.length - 1];

      const maxCODLimit = agent.permissions?.maxCODAmount ?? 0;
      const currentHolding = agent.codTracking?.currentCODHolding ?? 0;
      const dailyCollected = agent.codTracking?.dailyCollected ?? 0;

      // Determine COD status
      let codStatus = "OK";
      if (currentHolding > maxCODLimit) {
        codStatus = "Limit Crossed";
      } else if (currentHolding === maxCODLimit) {
        codStatus = "At Limit";
      }

      return {
        _id: agent._id,
        name: agent.fullName,
        phone: agent.phoneNumber,
        email: agent.email,

        maxCODLimit,
        currentCODHolding: currentHolding,
        dailyCollected,

        codStatus, // ← New field showing COD holding status

        lastSubmission: latestDrop
          ? {
              droppedAmount: latestDrop.droppedAmount,
              droppedAt: latestDrop.droppedAt,
              dropMethod: latestDrop.dropMethod,
              isVerifiedByAdmin: latestDrop.isVerifiedByAdmin,
              verifiedAt: latestDrop.verifiedAt,
            }
          : null,
      };
    });

    return res.status(200).json({
      success: true,
      data: agentSummaries,
    });
  } catch (err) {
    console.error("Error in getAgentCODSummary:", err);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};






exports.getCODMonitoring = async (req, res) => {
  try {
    const {
      search, // agent name or phone
      startDate,
      endDate,
      showExceededCOD,
      page = 1,
      limit = 10,
    } = req.query;

    const query = {};

    // 🔍 Search by name or phone
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
      ];
    }

    // 📅 Filter by date range (lastUpdated in codTracking)
    if (startDate || endDate) {
      query["codTracking.lastUpdated"] = {};
      if (startDate) query["codTracking.lastUpdated"].$gte = new Date(startDate);
      if (endDate) query["codTracking.lastUpdated"].$lte = new Date(endDate);
    }

    // ⚠️ Show only agents who exceeded COD
    if (showExceededCOD === "true") {
      query.$expr = {
        $gt: ["$codTracking.currentCODHolding", "$permissions.maxCODAmount"],
      };
    }

    // 📊 Fetch agents with pagination
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { "codTracking.lastUpdated": -1 }, // latest first
      select:
        "fullName phoneNumber permissions.maxCODAmount codTracking codSubmissionLogs",
    };

    const agents = await Agent.paginate(query, options);

    // 📈 Summary Calculations
    const totalCOD = await Agent.aggregate([
      { $group: { _id: null, total: { $sum: "$codTracking.currentCODHolding" } } },
    ]);

    const exceededAgents = await Agent.countDocuments({
      $expr: {
        $gt: ["$codTracking.currentCODHolding", "$permissions.maxCODAmount"],
      },
    });

    const unverifiedSubmissions = await Agent.aggregate([
      { $unwind: "$codSubmissionLogs" },
      { $match: { "codSubmissionLogs.isVerifiedByAdmin": false } },
      { $count: "count" },
    ]);

    return res.status(200).json({
      success: true,
      summary: {
        totalCODHeld: totalCOD[0]?.total || 0,
        agentsExceededCOD: exceededAgents,
        unverifiedSubmits: unverifiedSubmissions[0]?.count || 0,
      },
      data: agents.docs.map((agent) => ({
        id: agent._id,
        fullName: agent.fullName,
        phone: agent.phoneNumber,
        codLimit: agent.permissions.maxCODAmount,
        currentHolding: agent.codTracking.currentCODHolding,
        dailyCollected: agent.codTracking.dailyCollected,
        lastSubmitted:
          agent.codSubmissionLogs.length > 0
            ? agent.codSubmissionLogs[agent.codSubmissionLogs.length - 1].droppedAt
            : null,
        status:
          agent.codTracking.currentCODHolding > agent.permissions.maxCODAmount
            ? "Over"
            : "OK",
      })),
      pagination: {
        totalDocs: agents.totalDocs,
        totalPages: agents.totalPages,
        page: agents.page,
        limit: agents.limit,
      },
    });
  } catch (error) {
    console.error("COD Monitoring Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};



exports.updateAgentCODLimit = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { newLimit } = req.body;

    if (!newLimit || newLimit < 0) {
      return res.status(400).json({ success: false, message: "Invalid COD limit" });
    }

    const agent = await Agent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }

    // Update COD limit
    agent.permissions.maxCODAmount = newLimit;
    await agent.save();

    res.json({
      success: true,
      message: "COD Limit updated successfully",
      data: {
        id: agent._id,
        fullName: agent.fullName,
        phoneNumber: agent.phoneNumber,
        newLimit: agent.permissions.maxCODAmount,
      },
    });
  } catch (error) {
    console.error("Error updating COD Limit:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
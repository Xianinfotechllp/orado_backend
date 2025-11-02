const Agent = require("../../models/agentModel");
const Order = require("../../models/orderModel")
const User = require("../../models/userModel");
const AgentSelfie = require("../../models/AgentSelfieModel");
const AgentNotification = require('../../models/AgentNotificationModel');
const admin = require('../../config/firebaseAdmin'); 
const sendNotificationToAgent = require('../../utils/sendNotificationToAgent')
const AgentDeviceInfo = require("../../models/AgentDeviceInfoModel")
const AgentEarning = require("../../models/AgentEarningModel");
const AgentIncentiveEarning = require("../../models/AgentIncentiveEarningModel");
const { findApplicableSurgeZones } = require("../../utils/surgeCalculator");
const  calculateEarningsBreakdown  = require("../../utils/agentEarningCalculator");
const mongoose = require("mongoose");
const  getRedisClient  = require("../../config/redisClient");
const redis = getRedisClient();
const Product = require("../../models/productModel");
const geolib = require('geolib');
const moment = require('moment')
const AgentPayout = require("../../models/AgentPayoutModel")
const AgentEarningSettings = require("../../models/AgentEarningSettingModel")
const ExcelJS = require('exceljs');
const MilestoneReward = require("../../models/MilestoneRewardModel")
const AgentMilestoneProgress = require("../../models/agentIncentiveProgress")
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


exports.getAgentBasicDetails = async (req, res) => {
  try {
    const { agentId } = req.params;

    const agent = await Agent.findById(agentId).select(
      `
        fullName phoneNumber email profilePicture
        dashboard totalDeliveries totalCollections totalEarnings tips surge incentives
        points totalPoints lastAwardedDate
        bankDetailsProvided payoutDetails
        qrCode role agentStatus attendance feedback applicationStatus
        agentApplicationDocuments permissions codTracking leaves
        createdAt updatedAt
      `
    ).populate('attendance.attendanceLogs');

    if (!agent) {
      return res
        .status(404)
        .json({ success: false, message: "Agent not found" });
    }

    // Calculate derived fields for frontend
    const statusMap = {
      'AVAILABLE': 'Active',
      'OFFLINE': 'Offline',
      'ON_BREAK': 'On-Leave',
      'ORDER_ASSIGNED': 'On-Duty',
      'ORDER_ACCEPTED': 'On-Duty',
      'ARRIVED_AT_RESTAURANT': 'On-Duty',
      'PICKED_UP': 'On-Duty',
      'ON_THE_WAY': 'On-Duty',
      'AT_CUSTOMER_LOCATION': 'On-Duty',
      'DELIVERED': 'Active'
    };

    // Calculate duty hours from attendance
    const calculateDutyHours = (attendance) => {
      const lifetimeHours = attendance.daysWorked * 8; // Assuming 8 hours per day
      const thisMonth = new Date();
      const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
      
      // Calculate this month's worked days (simplified)
      const thisMonthWorkedDays = Math.floor(attendance.daysWorked / 30) * (thisMonth.getDate() / 30);
      const thisMonthHours = Math.floor(thisMonthWorkedDays * 8);
      
      // Today's hours (simplified - you might want to calculate from today's attendance logs)
      const todayHours = agent.agentStatus.status !== 'OFFLINE' ? 4 : 0;

      return {
        lifetime: lifetimeHours,
        thisMonth: thisMonthHours,
        today: todayHours
      };
    };

    // Calculate attendance percentages
    const calculateAttendancePercentages = (attendance) => {
      const totalDays = attendance.daysWorked + attendance.daysOff;
      const lifetimePercentage = totalDays > 0 ? (attendance.daysWorked / totalDays) * 100 : 0;
      
      // Monthly percentage (simplified)
      const monthlyPercentage = Math.max(85, Math.min(98, lifetimePercentage + (Math.random() * 10 - 5)));
      
      return {
        monthly: monthlyPercentage.toFixed(1),
        lifetime: lifetimePercentage.toFixed(1)
      };
    };

    // Transform leaves for frontend
    const transformLeaves = (leaves) => {
      return leaves
        .filter(leave => leave.status === 'Approved')
        .map(leave => {
          const start = new Date(leave.leaveStartDate);
          const end = new Date(leave.leaveEndDate);
          const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
          
          return {
            date: start.toISOString().split('T')[0],
            type: leave.leaveType,
            days: daysDiff
          };
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort by date descending
        .slice(0, 8); // Limit to 8 most recent leaves
    };

    // Get last active time
    const getLastActive = (updatedAt, agentStatus) => {
      if (agentStatus.status === 'OFFLINE') {
        return new Date(updatedAt).toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      return new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    // Calculate next duty (simplified - you might want to implement proper scheduling)
    const calculateNextDuty = (agentStatus) => {
      if (agentStatus.status === 'ON_BREAK') {
        const nextDuty = new Date();
        nextDuty.setDate(nextDuty.getDate() + 1);
        nextDuty.setHours(9, 0, 0, 0);
        return nextDuty.toISOString();
      }
      return null;
    };

    const dutyHours = calculateDutyHours(agent.attendance);
    const attendancePercentages = calculateAttendancePercentages(agent.attendance);
    const leaveRecords = transformLeaves(agent.leaves || []);
    const lastActive = getLastActive(agent.updatedAt, agent.agentStatus);
    const nextDuty = calculateNextDuty(agent.agentStatus);

    // Construct response matching frontend expectations
    const responseData = {
      id: agent._id.toString(),
      fullName: agent.fullName,
      image: agent.profilePicture || '',
      phoneNumber: agent.phoneNumber,
      email: agent.email,
      status: statusMap[agent.agentStatus.status] || 'Active',
      registrationDate: agent.createdAt.toISOString().split('T')[0],
      lastActive: lastActive,
      address: '123 Main St, Bangalore, KA', // You might want to store this in your schema
      vehicle: 'Bike - KA01AB1234', // You might want to store this in your schema
      rating: agent.feedback?.averageRating || 4.8,
      totalDeliveries: agent.dashboard?.totalDeliveries || 0,
      dutyHours: dutyHours,
      currentDutyTime: agent.agentStatus.status !== 'OFFLINE' ? '4h 30m' : '0h 0m',
      attendance: attendancePercentages,
      leaveRecords: leaveRecords,
      nextDuty: nextDuty,
      
      // Include backend fields for reference
      backendData: {
        agentStatus: agent.agentStatus,
        dashboard: agent.dashboard,
        points: agent.points,
        bankDetailsProvided: agent.bankDetailsProvided,
        attendance: agent.attendance,
        feedback: agent.feedback,
        applicationStatus: agent.applicationStatus,
        permissions: agent.permissions,
        codTracking: agent.codTracking
      }
    };

    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error("Error fetching agent profile:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
exports.getAgentLeaves = async (req, res) => {
  try {
    const { agentId } = req.params;

    // Find the agent by ID
    const agent = await Agent.findById(agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found"
      });
    }

    // Return the leaves array
    res.status(200).json({
      success: true,
      data: agent.leaves || [] // if leaves is empty, return empty array
    });
  } catch (error) {
    console.error("Error fetching leaves:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch leaves"
    });
  }
};



exports.getCurrentTask = async (req, res) => {
  try {
    const { agentId } = req.params;

    // Find one active order assigned to agent
    const order = await Order.findOne({
      assignedAgent: agentId,
    })
      .sort({ createdAt: -1 }) // latest
      .populate("restaurantId", "name address")
      .lean();

    if (!order) {
      return res.status(200).json({
        success: true,
        data: null,
        message: "No active task found",
      });
    }

    // Calculate elapsed time
    const now = new Date();
    const createdAt = new Date(order.agentAssignedAt || order.createdAt);
    const diffMs = now - createdAt;

    const diffSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;

    // Format like "2h 15m 30s" or "15m 20s" if no hours
    let elapsedTime = "";
    if (hours > 0) elapsedTime += `${hours}h `;
    if (minutes > 0) elapsedTime += `${minutes}m `;
    elapsedTime += `${seconds}s`;

    res.status(200).json({
      success: true,
      data: {
        orderId: order._id,
        pickup: order.restaurantId?.name || "Restaurant",
        drop: order.deliveryAddress || "Customer Location",
        agentDeliveryStatus: order.agentDeliveryStatus,
        earnings: order.deliveryCharge || 0,
        createdAt: order.createdAt,
        elapsedTime, // 👈 nicely formatted
      },
    });
  } catch (error) {
    console.error("Error fetching current task:", error);
    res.status(500).json({ success: false, message: "Failed to fetch current task" });
  }
}






exports.manualAssignAgent = async (req, res) => {
  try {
    const { orderId, agentId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    // 1️⃣ Fetch order
    const order = await Order.findById(orderId)
      .populate("restaurantId", "name address location")
      .populate("customerId", "name phone email");

    if (!order) return res.status(404).json({ message: "Order not found" });
    if (["completed", "delivered", "cancelled_by_customer"].includes(order.orderStatus)) {
      return res.status(400).json({ message: "Order already completed or invalid for assignment." });
    }

    // 2️⃣ Fetch agent
    const agent = await Agent.findById(agentId);
    if (!agent) return res.status(404).json({ message: "Agent not found." });

    // 3️⃣ Update order assignment
    order.assignedAgent = agentId;
    order.agentAssignmentStatus = "manually_assigned_by_admin";
    order.agentAssignmentTimestamp = new Date();
    await order.save();

    // 4️⃣ Calculate distance
    let mapboxDistance = 0.0;
    if (Array.isArray(order.restaurantId?.location?.coordinates) && Array.isArray(order.deliveryLocation?.coordinates)) {
      const fromCoords = order.restaurantId.location.coordinates;
      const toCoords = order.deliveryLocation.coordinates;

      if (fromCoords.length === 2 && toCoords.length === 2) {
        const accessToken = process.env.MAPBOX_ACCESS_TOKEN;
        try {
          const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromCoords[0]},${fromCoords[1]};${toCoords[0]},${toCoords[1]}?geometries=geojson&access_token=${accessToken}`;
          const response = await axios.get(url);
          if (response.data.routes && response.data.routes.length > 0) {
            mapboxDistance = parseFloat((response.data.routes[0].distance / 1000).toFixed(2));
          }
        } catch (err) {
          const distanceInMeters = geolib.getDistance(
            { latitude: fromCoords[1], longitude: fromCoords[0] },
            { latitude: toCoords[1], longitude: toCoords[0] }
          );
          mapboxDistance = parseFloat((distanceInMeters / 1000).toFixed(2));
        }
      }
    }

    // 5️⃣ Calculate surge zones
    let applicableSurges = [];
    try {
      applicableSurges = await findApplicableSurgeZones({
        fromCoords: order.restaurantId.location.coordinates,
        toCoords: order.deliveryLocation.coordinates,
        time: new Date(),
      });
    } catch (err) {
      console.warn("Failed to fetch surge zones:", err.message);
    }

    // 6️⃣ Calculate earnings
    const earningsConfig = await AgentEarningSettings.findOne({ mode: "global" });
    const earningsBreakdown = calculateEarningsBreakdown({
      distanceKm: mapboxDistance,
      config: earningsConfig?.toObject() || {},
      surgeZones: applicableSurges,
    });

    // 7️⃣ Construct payload
    const popupPayload = {
      orderDetails: {
        id: order._id?.toString() || "",
        totalPrice: parseFloat(order.totalAmount || 0),
        deliveryAddress: order.deliveryAddress || "",
        deliveryLocation: {
          lat: parseFloat(order.deliveryLocation?.coordinates?.[1] || 0),
          long: parseFloat(order.deliveryLocation?.coordinates?.[0] || 0),
        },
        createdAt: order.createdAt?.toISOString() || new Date().toISOString(),
        paymentMethod: order.paymentMethod || "cash",
        orderItems: (order.orderItems || []).map(item => ({
          name: item.name || "",
          qty: parseInt(item.qty || 0),
          price: parseFloat(item.price || 0),
        })),
        estimatedEarning: parseFloat(earningsBreakdown?.total || 0),
        distanceKm: parseFloat(mapboxDistance || 0),
        customer: {
          name: order.customerId?.name || "",
          phone: order.customerId?.phone || "",
          email: order.customerId?.email || "",
        },
        restaurant: {
          name: order.restaurantId?.name || "",
          address: order.restaurantId?.address || "",
          location: {
            lat: parseFloat(order.restaurantId?.location?.coordinates?.[1] || 0),
            long: parseFloat(order.restaurantId?.location?.coordinates?.[0] || 0),
          },
        },
      },
      allocationMethod: "manual_assignment",
      requestExpirySec: 30,
      showAcceptReject: false,
    };

    const safePayload = validatePayload(popupPayload);

    // 8️⃣ Emit notifications
    const io = req.app.get("io");

    await sendNotificationToAgent({
      agentId,
      title: "New Order Assignment",
      body: `You've been assigned to deliver from ${order.restaurantId?.name} to ${order.deliveryAddress}. Total: ₹${order.totalAmount}`,
      data: {   type: "order_assignment",
    orderId: order._id.toString(),
    totalAmount: (order.totalAmount || 0).toString(),
    restaurantName: order.restaurantId?.name || ""},
    });

    // Emit to customer
    if (order.customerId?._id) {
      io.to(`user_${order.customerId._id}`).emit("agentAssigned", {
        orderId: order._id.toString(),
        agent: {
          agentId: agent._id.toString(),
          fullName: agent.fullName || "",
          phoneNumber: agent.phoneNumber || "",
        },
      });
    }
console.log("Emitting to agent:", `agent_${agent._id}`, "Payload:", safePayload);
    // Emit to agent
    if (agent._id) {
      io.to(`agent_${agent._id}`).emit("order:new", safePayload);
      io.to(`agent_${agent._id}`).emit("orderAssigned", {
        status: "success",
        assignedOrders: [{
          id: order._id.toString(),
          totalAmount: parseFloat(order.totalAmount || 0),
        }],
      });
    }

    // 9️⃣ Response
    res.status(200).json({
      message: "Agent manually assigned successfully.",
      order: {
        id: order._id.toString(),
        status: order.orderStatus,
        totalAmount: parseFloat(order.totalAmount || 0),
      },
      agent: {
        id: agent._id.toString(),
        name: agent.fullName || "",
      },
    });

  } catch (error) {
    console.error("❌ Manual assignment error:", error);
    res.status(500).json({ message: "Internal server error.", error: error.message });
  }
};

// Payload validation function
function validatePayload(payload) {
  const validated = JSON.parse(JSON.stringify(payload));

  validated.orderDetails.totalPrice = parseFloat(validated.orderDetails.totalPrice) || 0;
  validated.orderDetails.distanceKm = parseFloat(validated.orderDetails.distanceKm) || 0;
  validated.orderDetails.estimatedEarning = parseFloat(validated.orderDetails.estimatedEarning) || 0;

  validated.orderDetails.deliveryLocation.lat = parseFloat(validated.orderDetails.deliveryLocation.lat) || 0;
  validated.orderDetails.deliveryLocation.long = parseFloat(validated.orderDetails.deliveryLocation.long) || 0;

  validated.orderDetails.restaurant.location.lat = parseFloat(validated.orderDetails.restaurant.location.lat) || 0;
  validated.orderDetails.restaurant.location.long = parseFloat(validated.orderDetails.restaurant.location.long) || 0;

  validated.orderDetails.orderItems = (validated.orderDetails.orderItems || []).map(item => ({
    name: item.name || "",
    qty: parseInt(item.qty || 0),
    price: parseFloat(item.price || 0),
  }));

  return validated;
}









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



// exports.getAgentPayouts = async (req, res) => {
//   try {
//     // Step 1: Aggregate earnings per agent
//     const earnings = await AgentEarning.aggregate([
//       {
//         $group: {
//           _id: "$agentId",
//           orders: { $sum: 1 },
//           earnings: { $sum: "$totalEarning" },
//           tips: { $sum: "$tipAmount" },
//           surge: { $sum: "$surgeAmount" },
//           totalPaid: { $sum: "$paidAmount" },
//           payoutStatuses: { $addToSet: "$payoutStatus" },
//         },
//       },
//     ]);

//     // Step 2: Aggregate incentives per agent
//     const incentives = await AgentIncentiveEarning.aggregate([
//       {
//         $group: {
//           _id: { agentId: "$agentId", periodType: "$periodType" },
//           incentive: { $sum: "$incentiveAmount" },
//         },
//       },
//     ]);

//     // Step 3: Transform incentives into daily/weekly/monthly map
//     const incentiveMap = {};
//     incentives.forEach((inc) => {
//       const agentId = inc._id.agentId.toString();
//       if (!incentiveMap[agentId]) {
//         incentiveMap[agentId] = { daily: 0, weekly: 0, monthly: 0 };
//       }
//       if (inc._id.periodType === "daily") incentiveMap[agentId].daily += inc.incentive;
//       else if (inc._id.periodType === "weekly") incentiveMap[agentId].weekly += inc.incentive;
//       else if (inc._id.periodType === "monthly") incentiveMap[agentId].monthly += inc.incentive;
//     });

//     // Step 4: Merge earnings + incentives + populate agent details
//     const result = await Promise.all(
//       earnings.map(async (e) => {
//         const agentId = e._id.toString();
//         const agent = await Agent.findById(agentId).select("fullName _id"); // select only required fields
//         const dailyInc = incentiveMap[agentId]?.daily || 0;
//         const weeklyInc = incentiveMap[agentId]?.weekly || 0;
//         const monthlyInc = incentiveMap[agentId]?.monthly || 0;
//         const totalIncentive = dailyInc + weeklyInc + monthlyInc;

//         return {
//   agentId,
//   agentName: agent?.fullName || "Unknown",
//   orders: e.orders,
//   earnings: e.earnings,
//   tips: e.tips,
//   surge: e.surge,
//   dailyIncentive: dailyInc,
//   weeklyIncentive: weeklyInc,
//   monthlyIncentive: monthlyInc,
//   totalIncentive,
//   totalPayout: e.earnings + totalIncentive, // <-- use total earnings, not paidAmount
//   amountPaid: e.totalPaid, // optional: how much has been already paid
//   status: e.payoutStatuses.includes("pending")
//     ? "pending"
//     : e.payoutStatuses.includes("partial")
//     ? "partial"
//     : "paid",
// };
//       })
//     );

//     res.json(result);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to fetch agent payouts" });
//   }
// };




const getPeriodIdentifier = (periodType, date) => {
  const m = moment(date);
  switch (periodType) {
    case 'weekly':
      return `${m.year()}-w${m.isoWeek()}`;
    case 'monthly':
      return `${m.year()}-m${m.month() + 1}`;
    case 'daily':
    default:
      return m.format('YYYY-MM-DD');
  }
};


exports.getAgentPayouts = async (req, res) => {
  try {
    const { period = 'daily', date, startDate, endDate } = req.query;
    const queryDate = date ? moment(date) : moment();
    const customStart = startDate ? moment(startDate) : null;
    const customEnd = endDate ? moment(endDate) : null;

    const agents = await Agent.find().lean();

    // Use Promise.all to fetch all agent data concurrently
    const payouts = await Promise.all(
      agents.map(async (agent) => {
        // Determine period start/end
        let start, end;
        if (customStart && customEnd) {
          start = customStart.clone().startOf('day');
          end = customEnd.clone().endOf('day');
        } else {
          switch (period) {
            case 'weekly':
              start = queryDate.clone().startOf('isoWeek');
              end = queryDate.clone().endOf('isoWeek');
              break;
            case 'monthly':
              start = queryDate.clone().startOf('month');
              end = queryDate.clone().endOf('month');
              break;
            case 'daily':
            default:
              start = queryDate.clone().startOf('day');
              end = queryDate.clone().endOf('day');
              break;
          }
        }

        // Fetch earnings for this agent and period
        const earnings = await AgentEarning.find({
          agentId: agent._id,
          createdAt: { $gte: start.toDate(), $lte: end.toDate() },
        });

        const totalBaseEarnings = earnings.reduce((sum, e) => sum + (e.baseDeliveryFee + e.extraDistanceFee), 0);
        const totalTips = earnings.reduce((sum, e) => sum + e.tipAmount, 0);
        const totalSurge = earnings.reduce((sum, e) => sum + e.surgeAmount, 0);
        const totalOrderIncentives = earnings.reduce((sum, e) => sum + e.incentiveAmount, 0);

        // Fetch period incentives concurrently
        const [dailyInc, weeklyInc, monthlyInc, payoutRecord] = await Promise.all([
          AgentIncentiveEarning.findOne({
            agentId: agent._id,
            periodType: 'daily',
            periodIdentifier: getPeriodIdentifier('daily', start),
          }),
          AgentIncentiveEarning.findOne({
            agentId: agent._id,
            periodType: 'weekly',
            periodIdentifier: getPeriodIdentifier('weekly', start),
          }),
          AgentIncentiveEarning.findOne({
            agentId: agent._id,
            periodType: 'monthly',
            periodIdentifier: getPeriodIdentifier('monthly', start),
          }),
          AgentPayout.findOne({
            agentId: agent._id,
            periodType: period,
            periodIdentifier: getPeriodIdentifier(period, start),
          }),
        ]);

        // Decide which incentives to show
        let showDaily = 0, showWeekly = 0, showMonthly = 0;
        if (period === 'daily') showDaily = dailyInc?.incentiveAmount || 0;
        if (period === 'weekly') {
          showDaily = dailyInc?.incentiveAmount || 0;
          showWeekly = weeklyInc?.incentiveAmount || 0;
        }
        if (period === 'monthly') {
          showDaily = dailyInc?.incentiveAmount || 0;
          showWeekly = weeklyInc?.incentiveAmount || 0;
          showMonthly = monthlyInc?.incentiveAmount || 0;
        }

        const totalIncentives = showDaily + showWeekly + showMonthly;
        const totalPayout = totalBaseEarnings + totalTips + totalSurge + totalOrderIncentives + totalIncentives;

        // Get paid amount from AgentPayout
        const paidAmount = payoutRecord?.paidAmount || 0;
        const pendingAmount = totalPayout - paidAmount;

        return {
          agentId: agent._id,
          agentName: agent.fullName,
          totalOrders: earnings.length,
          totalBaseEarnings,
          totalTips,
          totalSurge,
          totalOrderIncentives,
          dailyIncentive: showDaily,
          weeklyIncentive: showWeekly,
          monthlyIncentive: showMonthly,
          totalIncentives,
          totalPayout,
          paidAmount,
          pendingAmount,
          status: payoutRecord?.payoutStatus || 'pending',
        };
      })
    );

    return res.json({
      period,
      start: (customStart || queryDate).toDate(),
      end: (customEnd || queryDate).toDate(),
      payouts,
    });
  } catch (err) {
    console.error('Error fetching agent payouts:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};


exports.exportAgentPayoutsExcel = async (req, res) => {
  try {
    const { period = 'daily', startDate, endDate } = req.query;

    // Determine date range filter
    let start = startDate ? moment(startDate).startOf('day') : null;
    let end = endDate ? moment(endDate).endOf('day') : null;

    const query = {};
    if (period) query.periodType = period;
    if (start && end) query.createdAt = { $gte: start.toDate(), $lte: end.toDate() };

    // Fetch payouts with agent name
    const payouts = await AgentPayout.find(query)
      .populate('agentId', 'fullName')
      .lean();

    // Create Excel workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Agent Payouts');

    // Define columns
    worksheet.columns = [
      { header: 'Agent Name', key: 'agentName', width: 25 },
      { header: 'Period Type', key: 'periodType', width: 15 },
      { header: 'Period Identifier', key: 'periodIdentifier', width: 20 },
      { header: 'Total Earnings', key: 'totalEarnings', width: 15 },
      { header: 'Total Tips', key: 'totalTips', width: 15 },
      { header: 'Total Surge', key: 'totalSurge', width: 15 },
      { header: 'Total Incentives', key: 'totalIncentives', width: 15 },
      { header: 'Total Payout', key: 'totalPayout', width: 15 },
      { header: 'Paid Amount', key: 'paidAmount', width: 15 },
      { header: 'Pending Amount', key: 'pendingAmount', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
    ];
console.log('Payouts found:', payouts.length);
console.log(
  payouts.map(p => ({
    agentName: p.agentId?.fullName,
    totalPayout: p.totalPayout,
    paidAmount: p.paidAmount,
    pendingAmount: p.totalPayout - p.paidAmount,
    status: p.payoutStatus
  }))
);

    // Add data rows
   payouts.forEach(p => {
  worksheet.addRow({
    agentName: p.agentId?.fullName || 'N/A',
    periodType: p.periodType,
    periodIdentifier: p.periodIdentifier,
    totalEarnings: p.totalEarnings,
    totalTips: p.totalTips,
    totalSurge: p.totalSurge,
    totalIncentives: p.totalIncentives,
    totalPayout: p.totalPayout,
    paidAmount: p.paidAmount,
    pendingAmount: p.totalPayout - p.paidAmount,
    status: p.payoutStatus,
  });
});
    // Set response headers for download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Agent_Payouts_${moment().format('YYYYMMDD_HHmm')}.xlsx`
    );

    // Send Excel file
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting agent payouts to Excel:', error);
    res.status(500).json({ message: 'Server error' });
  }
};




const sumField = (records, field) => records.reduce((sum, r) => sum + (r[field] || 0), 0);

exports.getAgentEarningsSummary = async (req, res) => {
  try {
    const { agentId } = req.query;
    const { from, to } = req.query;

    if (!agentId) {
      return res.status(400).json({ message: "agentId is required" });
    }

    // Prepare date filters
    const startOfToday = moment().startOf('day');
    const endOfToday = moment().endOf('day');
    const startOfWeek = moment().startOf('week');
    const startOfMonth = moment().startOf('month');

    const filter = { agentId };
    if (from && to) {
      filter.createdAt = {
        $gte: moment(from).startOf('day').toDate(),
        $lte: moment(to).endOf('day').toDate(),
      };
    }

    // All earnings (for lifetime total)
    const allEarnings = await AgentEarning.find({ agentId });

    // Time-based earnings
    const todayEarnings = allEarnings.filter(e => moment(e.createdAt).isBetween(startOfToday, endOfToday));
    const weekEarnings = allEarnings.filter(e => moment(e.createdAt).isAfter(startOfWeek));
    const monthEarnings = allEarnings.filter(e => moment(e.createdAt).isAfter(startOfMonth));

    // Lifetime
    const lifetime = sumField(allEarnings, 'totalEarning');

    // Range breakdown (if from-to provided)
    const rangeEarnings = await AgentEarning.find(filter).populate('orderId', 'orderNumber');

    // Prepare breakdown totals
    const breakdown = {
      deliveryFee: sumField(rangeEarnings, 'baseDeliveryFee'),
      incentives: sumField(rangeEarnings, 'incentiveAmount'),
      tips: sumField(rangeEarnings, 'tipAmount'),
      surge: sumField(rangeEarnings, 'surgeAmount'),
      total: sumField(rangeEarnings, 'totalEarning'),
    };

    // Prepare detailed table
    const detailed = rangeEarnings.map((e) => ({
      orderId: e.orderId?.orderNumber || e.orderId,
      deliveryFee: e.baseDeliveryFee,
      tip: e.tipAmount,
      incentive: e.incentiveAmount,
      surge: e.surgeAmount,
      total: e.totalEarning,
      date: e.createdAt,
    }));

    return res.status(200).json({
      success: true,
      summary: {
        today: sumField(todayEarnings, 'totalEarning'),
        thisWeek: sumField(weekEarnings, 'totalEarning'),
        thisMonth: sumField(monthEarnings, 'totalEarning'),
        lifetime,
      },
      breakdown,
      detailed,
    });
  } catch (error) {
    console.error('Admin Earnings Fetch Error:', error);
    return res.status(500).json({ message: 'Server Error', error });
  }
};










exports.getAllAgentsMilestoneSummary = async (req, res) => {
  try {
    const agents = await Agent.find().select("fullName email").lean();
    const milestones = await MilestoneReward.find({ active: true }).sort({ level: 1 }).lean();

    const summaryList = [];

    for (const agent of agents) {
      const agentProgress = await AgentMilestoneProgress.findOne({ agentId: agent._id }).lean();

      for (const milestone of milestones) {
        // Find agent's progress or initialize empty
        const progress = (agentProgress?.milestones || []).find(
          (m) => m.milestoneId?.toString() === milestone._id.toString()
        ) || {
          conditionsProgress: { totalDeliveries: 0, onTimeDeliveries: 0, totalEarnings: 0 },
          status: "Locked"
        };

        const conditions = milestone.conditions || {};
        const progressConditions = progress.conditionsProgress || {};

        // Calculate individual progress for each condition
        const conditionProgressArr = Object.keys(conditions).map((key) => {
          const target = conditions[key] || 0;
          const done = progressConditions[key] || 0;
          const percent = target ? Math.min((done / target) * 100, 100) : 0;
          return { key, done, target, percent };
        });

        // Average percent across all conditions
        const avgPercent = conditionProgressArr.length
          ? Math.round(conditionProgressArr.reduce((sum, c) => sum + c.percent, 0) / conditionProgressArr.length)
          : 0;

        summaryList.push({
          agentName: agent.fullName,
          email: agent.email,
          level: milestone.level,
          milestoneTitle: milestone.title,
          progressDetails: conditionProgressArr, // ✅ include all conditions for display in admin
          progressPercent: avgPercent,
          status: progress.status || "Locked",
        });
      }
    }

    res.json({ success: true, summary: summaryList });
  } catch (error) {
    console.error("❌ Error fetching all agent milestones:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};







exports.getAgentDisciplinarySummary = async (req, res) => {
  try {
    const { agentId } = req.params;

    if (!agentId) {
      return res.status(400).json({ success: false, message: "agentId is required" });
    }

    // Fetch agent and only needed fields
    const agent = await Agent.findById(agentId)
      .select("fullName email phoneNumber warnings leaves permissionRequests termination createdAt")
      .lean();

    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }

    // 🧾 Warning Summary
    const totalWarnings = agent.warnings?.length || 0;
    const warnings = agent.warnings?.map((w) => ({
      reason: w.reason,
      severity: w.severity,
      issuedAt: w.issuedAt?.toISOString().split("T")[0],
    })) || [];

    // 📝 Leave Summary
    const totalApprovals = agent.leaves?.filter((l) => l.status === "Approved").length || 0;
    const pendingApprovals = agent.leaves?.filter((l) => l.status === "Pending").length || 0;
    const leaves = agent.leaves?.map((l) => ({
      leaveType: l.leaveType,
      reason: l.reason,
      startDate: l.leaveStartDate?.toISOString().split("T")[0],
      endDate: l.leaveEndDate?.toISOString().split("T")[0],
      status: l.status,
    })) || [];

    // ⚙️ Termination Summary
    let terminationSummary = {
      terminated: agent.termination?.terminated || false,
      message: "This agent has a clean employment record with no terminations.",
    };

    if (agent.termination?.terminated) {
      terminationSummary = {
        terminated: true,
        terminatedAt: agent.termination.terminatedAt?.toISOString().split("T")[0],
        reason: agent.termination.reason || "No reason specified",
      };
    }

    // 🧮 Final structured data for Admin panel
    const summary = {
      agentName: agent.fullName,
      phoneNumber: agent.phoneNumber,
      email: agent.email,
      joinDate: agent.createdAt?.toISOString().split("T")[0],
      activeMonitoring: {
        totalWarnings,
        totalApprovals,
        pendingApprovals,
        terminations: terminationSummary.terminated ? 1 : 0,
      },
      warnings,
      leaves,
      termination: terminationSummary,
    };

    return res.status(200).json({ success: true, data: summary });
  } catch (error) {
    console.error("Error in getAgentDisciplinarySummary:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.getAgentDisciplinarySummary = async (req, res) => {
  try {
    const { agentId } = req.params;

    if (!agentId) {
      return res.status(400).json({ success: false, message: "agentId is required" });
    }

    // Fetch agent and only needed fields
    const agent = await Agent.findById(agentId)
      .select("fullName email phoneNumber warnings leaves permissionRequests termination createdAt")
      .lean();

    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }

    // 🧾 Warning Summary
    const totalWarnings = agent.warnings?.length || 0;
    const warnings = agent.warnings?.map((w) => ({
      reason: w.reason,
      severity: w.severity,
      issuedAt: w.issuedAt?.toISOString().split("T")[0],
    })) || [];

    // 📝 Leave Summary
    const totalApprovals = agent.leaves?.filter((l) => l.status === "Approved").length || 0;
    const pendingApprovals = agent.leaves?.filter((l) => l.status === "Pending").length || 0;
    const leaves = agent.leaves?.map((l) => ({
      leaveType: l.leaveType,
      reason: l.reason,
      startDate: l.leaveStartDate?.toISOString().split("T")[0],
      endDate: l.leaveEndDate?.toISOString().split("T")[0],
      status: l.status,
    })) || [];

    // ⚙️ Termination Summary
    let terminationSummary = {
      terminated: agent.termination?.terminated || false,
      message: "This agent has a clean employment record with no terminations.",
    };

    if (agent.termination?.terminated) {
      terminationSummary = {
        terminated: true,
        terminatedAt: agent.termination.terminatedAt?.toISOString().split("T")[0],
        reason: agent.termination.reason || "No reason specified",
      };
    }

    // 🧮 Final structured data for Admin panel
    const summary = {
      agentName: agent.fullName,
      phoneNumber: agent.phoneNumber,
      email: agent.email,
      joinDate: agent.createdAt?.toISOString().split("T")[0],
      activeMonitoring: {
        totalWarnings,
        totalApprovals,
        pendingApprovals,
        terminations: terminationSummary.terminated ? 1 : 0,
      },
      warnings,
      leaves,
      termination: terminationSummary,
    };

    return res.status(200).json({ success: true, data: summary });
  } catch (error) {
    console.error("Error in getAgentDisciplinarySummary:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

  exports.getAgentTodaySummary = async (req, res) => {
    try {
      const agentId = req.query.params; // assuming logged-in agent
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      // 1️⃣ Completed Orders
      const completedOrders = await Order.find({
        assignedAgent: agentId,
        orderStatus: "delivered",
        deliveredAt: { $gte: startOfDay, $lte: endOfDay },
      }).select("agentAcceptedAt deliveredAt");

      // 2️⃣ Cancelled Orders
      const cancelledCount = await Order.countDocuments({
        assignedAgent: agentId,
        orderStatus: { $in: ["cancelled", "cancelled_by_customer"] },
        updatedAt: { $gte: startOfDay, $lte: endOfDay },
      });

      // 3️⃣ Earnings from AgentEarning
      const earnings = await AgentEarning.aggregate([
        {
          $match: {
            agentId: new mongoose.Types.ObjectId(agentId),
            createdAt: { $gte: startOfDay, $lte: endOfDay },
          },
        },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: "$totalEarning" },
          },
        },
      ]);

      const totalEarnings = earnings.length ? earnings[0].totalEarnings : 0;

      // 4️⃣ Average Delivery Time (in minutes)
      let avgTime = 0;
      if (completedOrders.length > 0) {
        const totalMinutes = completedOrders.reduce((sum, order) => {
          if (order.agentAcceptedAt && order.deliveredAt) {
            const diffMs =
              new Date(order.deliveredAt) - new Date(order.agentAcceptedAt);
            return sum + diffMs / 60000; // convert ms → minutes
          }
          return sum;
        }, 0);
        avgTime = (totalMinutes / completedOrders.length).toFixed(1);
      }

      // ✅ Final Summary
      return res.json({
        success: true,







        
        summary: {
          completed: completedOrders.length,
        
          cancelled: cancelledCount,
          earnings: totalEarnings,
          avgTime: avgTime,
        },
      });
    } catch (error) {
      console.error("Error in getAgentTodaySummary:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }





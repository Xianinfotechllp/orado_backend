const Agent = require("../models/agentModel");
const AgentEarning = require("../models/AgentEarningModel");
const Order = require("../models/orderModel");
const User = require("../models/userModel");
const Session = require("../models/session");
const Restaurant = require("../models/restaurantModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const {
  addAgentEarnings,
  addRestaurantEarnings,
  createRestaurantEarning,
} = require("../services/earningService");
const { uploadOnCloudinary } = require("../utils/cloudinary");
const {
  findAndAssignNearestAgent,
} = require("../services/findAndAssignNearestAgent");
const { sendPushNotification } = require("../utils/sendPushNotification");
const AgentDeviceInfo = require("../models/AgentDeviceInfoModel");
const Product = require("../models/productModel");
const formatOrderResponse = require("../utils/formatOrderResponse");
const { fr } = require("../utils/formatOrder");
const formatOrder = require("../utils/formatOrder");
const { notifyNextPendingAgent  } = require("../services/allocationService");
const { sendNotificationToAdmins } = require("../services/notificationService")
const AgentNotification = require("../models/AgentNotificationModel");
const AgentSelfie = require("../models/AgentSelfieModel");
exports.registerAgent = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Basic Validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const phoneRegex = /^(\+91)?[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res
        .status(400)
        .json({ message: "Invalid Indian phone number format" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (password.length < 6 || !/\d/.test(password)) {
      return res.status(400).json({
        message: "Password must be at least 6 characters and contain a number",
      });
    }

    // Check if agent exists
    const existingAgent = await Agent.findOne({
      $or: [{ email }, { phoneNumber: phone }],
    });
    if (existingAgent) {
      return res.status(409).json({ message: "Agent already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Upload documents from req.files
    const { license, insurance, profilePicture, rcBook, pollutionCertificate } =
      req.files || {};

    let licenseUrl = "",
      insuranceUrl = "",
      profilePicUrl = "",
      rcBookUrl = "",
      pollutionUrl = "";

    if (license?.[0]) {
      const result = await uploadOnCloudinary(license[0].path);
      licenseUrl = result?.secure_url;
    }
    if (insurance?.[0]) {
      const result = await uploadOnCloudinary(insurance[0].path);
      insuranceUrl = result?.secure_url;
    }
    if (profilePicture?.[0]) {
      const result = await uploadOnCloudinary(profilePicture[0].path);
      profilePicUrl = result?.secure_url;
    }
    if (rcBook?.[0]) {
      const result = await uploadOnCloudinary(rcBook[0].path);
      rcBookUrl = result?.secure_url;
    }
    if (pollutionCertificate?.[0]) {
      const result = await uploadOnCloudinary(pollutionCertificate[0].path);
      pollutionUrl = result?.secure_url;
    }

    // Create new Agent
    const newAgent = new Agent({
      fullName: name,
      email,
      phoneNumber: phone,
      password: hashedPassword,
      profilePicture: profilePicUrl || null,
      applicationStatus: "pending",
      role: "agent",

      agentApplicationDocuments: {
        license: licenseUrl,
        insurance: insuranceUrl,
        rcBook: rcBookUrl,
        pollutionCertificate: pollutionUrl,
        submittedAt: new Date(),
      },

      // Defaults initialized from schema:
      // bankAccountDetails, payoutDetails, dashboard, deliveryStatus, etc.
    });

    await newAgent.save();

    return res.status(201).json({
      message: "Agent application submitted. Pending admin approval.",
      agent: {
        _id: newAgent._id,
        fullName: newAgent.fullName,
        email: newAgent.email,
        phoneNumber: newAgent.phoneNumber,
        applicationStatus: newAgent.applicationStatus,
      },
    });
  } catch (error) {
    console.error("Agent registration error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

exports.loginAgent = async (req, res) => {
  try {
    const { identifier, password, fcmToken } = req.body;

    if (!identifier || !password) {
      return res
        .status(400)
        .json({ message: "Phone/email and password are required" });
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const isPhone = /^(\+91)?[6-9]\d{9}$/.test(identifier);

    if (!isEmail && !isPhone) {
      return res.status(400).json({ message: "Invalid phone/email format" });
    }

    const agent = await Agent.findOne(
      isEmail ? { email: identifier } : { phoneNumber: identifier }
    ).select("+password");

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    if (agent.applicationStatus !== "approved") {
      return res.status(403).json({ message: "Agent not approved yet" });
    }

    const isMatch = await bcrypt.compare(password, agent.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    // ✅ Store FCM token if provided and not already saved
    if (fcmToken && !agent.fcmTokens.some(t => t.token === fcmToken)) {
      agent.fcmTokens.push({ token: fcmToken });
      await agent.save();
    }

    const token = jwt.sign(
      { agentId: agent._id, role: agent.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const MAX_SESSIONS = 1;
    const existingSessions = await Session.find({ userId: agent._id }).sort({ createdAt: 1 });

    if (existingSessions.length >= MAX_SESSIONS) {
      const oldest = existingSessions[0];
      await Session.findByIdAndDelete(oldest._id);
    }

    const userAgent = req.headers["user-agent"] || "Unknown Device";
    const ip = req.ip || req.connection?.remoteAddress || "Unknown IP";

    await Session.create({
      userId: agent._id,
      token,
      userAgent,
      ip,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return res.status(200).json({
      message: "Login successful",
      token,
      agent: {
        _id: agent._id,
        fullName: agent.fullName,
        email: agent.email,
        phoneNumber: agent.phoneNumber,
        profilePicture: agent.profilePicture,
        role: agent.role,
        applicationStatus: agent.applicationStatus,
      },
    });
  } catch (error) {
    console.error("Agent login error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


// Logout user by deleting session

exports.logoutAgent = async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(400).json({ message: "Token required" });

  await Session.findOneAndDelete({ token });
  res.json({ message: "Logged out successfully" });
};

exports.handleAgentResponse = async (req, res) => {
  try {
    const { orderId, agentId, response } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const agent = await Agent.findById(agentId);
    if (!agent) return res.status(404).json({ error: "Agent not found" });

    if (order.assignedAgent.toString() !== agentId)
      return res
        .status(400)
        .json({ error: "This order is not assigned to you" });

    if (order.orderStatus !== "pending_agent_acceptance")
      return res
        .status(400)
        .json({ error: "This order doesn't require acceptance" });

    const io = req.app.get("io");

    if (response === "accept") {
      await Order.findByIdAndUpdate(orderId, {
        orderStatus: "assigned_to_agent",
        agentAcceptedAt: new Date(),
      });

      await Agent.findByIdAndUpdate(agentId, {
        "deliveryStatus.status": "in_progress",
        $addToSet: { "deliveryStatus.currentOrderIds": orderId },
      });

      // Notify agent to start delivery tracking
      io.to(`agent_${agentId}`).emit("startDeliveryTracking", {
        orderId,
        customerId: order.customerId,
        restaurantId: order.restaurantId,
      });

      // Notify customer
      io.to(`user_${order.customerId.toString()}`).emit("agentAssigned", {
        agentId,
        orderId,
      });

      // Notify restaurant
      io.to(`restaurant_${order.restaurantId.toString()}`).emit(
        "agentAssigned",
        {
          agentId,
          orderId,
        }
      );

      // Send push notifications
      await sendPushNotification(
        order.customerId,
        "Order Accepted",
        "Your delivery is now on the way!"
      );
      await sendPushNotification(
        order.restaurantId,
        "Agent Accepted",
        "An agent accepted the order and is on the way."
      );

      return res.json({ message: "Order accepted successfully" });
    } else if (response === "reject") {
      await Order.findByIdAndUpdate(orderId, {
        assignedAgent: null,
        orderStatus: "awaiting_agent_assignment",
        $push: {
          rejectionHistory: {
            agentId,
            rejectedAt: new Date(),
          },
        },
      });

      await Agent.findByIdAndUpdate(agentId, {
        $inc: { "deliveryStatus.currentOrderCount": -1 },
        $pull: { "deliveryStatus.currentOrderIds": orderId },
      });

      const newAgent = await findAndAssignNearestAgent(orderId, {
        longitude: order.location.coordinates[0],
        latitude: order.location.coordinates[1],
      });

      if (!newAgent) {
        return res.json({
          message: "Order rejected. No other agents currently available",
          orderStatus: "awaiting_agent_assignment",
        });
      }

      const newStatus = newAgent.permissions.canAcceptOrRejectOrders
        ? "pending_agent_acceptance"
        : "assigned_to_agent";

      await Order.findByIdAndUpdate(orderId, {
        assignedAgent: newAgent._id,
        orderStatus: newStatus,
      });

      // If no acceptance needed, start tracking immediately
      if (!newAgent.permissions.canAcceptOrRejectOrders) {
        io.to(`agent_${newAgent._id.toString()}`).emit(
          "startDeliveryTracking",
          {
            orderId,
            customerId: order.customerId,
            restaurantId: order.restaurantId,
          }
        );

        io.to(`user_${order.customerId.toString()}`).emit("agentAssigned", {
          agentId: newAgent._id,
          orderId,
        });

        io.to(`restaurant_${order.restaurantId.toString()}`).emit(
          "agentAssigned",
          {
            agentId: newAgent._id,
            orderId,
          }
        );

        await sendPushNotification(
          order.customerId,
          "New Agent Assigned",
          "A new agent has been auto-assigned to your order."
        );
        await sendPushNotification(
          order.restaurantId,
          "Agent Reassigned",
          "A new agent has been assigned to the order."
        );
      }

      return res.json({
        message: "Order rejected and reassigned to another agent",
        newAgent: newAgent.fullName,
        orderStatus: newStatus,
      });
    }

    return res.status(400).json({ error: "Invalid response" });
  } catch (err) {
    console.error("Error handling agent response:", err);
    res.status(500).json({ error: "Failed to process agent response" });
  }
};

exports.agentUpdatesOrderStatus = async (req, res) => {
  const { agentId, orderId } = req.params;
  const { newStatus } = req.body;
  const io = req.app.get("io");

  const allowedStatuses = [
    "assigned_to_agent",
    "picked_up",
    "in_progress",
    "completed",
    "delivered",
    "cancelled_by_customer",
    "pending_agent_acceptance",
    "available",
    "arrived",
    "on_the_way",
  ];

  if (!allowedStatuses.includes(newStatus)) {
    return res.status(400).json({
      error: `Invalid status. Allowed statuses: ${allowedStatuses.join(", ")}`,
    });
  }

  try {
    const [agent, order] = await Promise.all([
      Agent.findById(agentId),
      Order.findById(orderId)
        .populate("customerId", "_id")
        .populate("restaurantId", "_id"),
    ]);

    if (!agent) return res.status(404).json({ error: "Agent not found" });
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (String(order.assignedAgent) !== String(agent._id)) {
      return res.status(403).json({
        error: "You are not authorized to update the status of this order.",
      });
    }

    // Map order statuses to agent statuses where applicable
    const statusMap = {
      assigned_to_agent: "ORDER_ASSIGNED",
      picked_up: "PICKED_UP",
      in_progress: "ON_THE_WAY",
      arrived: "AT_CUSTOMER_LOCATION",
      delivered: "AVAILABLE",
    };

    // Update agent status
    if (newStatus === "delivered") {
      agent.agentStatus.status = "AVAILABLE";
      agent.agentStatus.availabilityStatus = "AVAILABLE";
    } else if (statusMap[newStatus]) {
      agent.agentStatus.status = statusMap[newStatus];
      agent.agentStatus.availabilityStatus = "UNAVAILABLE";
    }

    await agent.save();

    // Update order status if allowed
    const orderStatusUpdatable = [
      "picked_up",
      "in_progress",
      "arrived",
      "delivered",
    ];
    if (orderStatusUpdatable.includes(newStatus)) {
      order.orderStatus = newStatus;
      await order.save();
    }

    // Notify customer via Socket.IO if relevant
    const notifyCustomerStatuses = [
      "picked_up",
      "in_progress",
      "arrived",
      "delivered",
    ];
    if (notifyCustomerStatuses.includes(newStatus)) {
      io.to(`user_${order.customerId._id}`).emit("order_status_update", {
        orderId,
        newStatus,
        timestamp: new Date(),
      });
    }

    // If delivered — handle restaurant earning and agent free notification
    if (newStatus === "delivered") {
      try {
        await createRestaurantEarning(order);
      } catch (err) {
        console.error("Error creating restaurant earning:", err);
      }

      io.to(`restaurant_${order.restaurantId._id}`).emit(
        "agent_status_update",
        {
          agentId,
          activityStatus: "Free",
          orderId,
          timestamp: new Date(),
        }
      );
    }

    res.status(200).json({
      message: "Agent order status updated successfully",
      agentStatus: agent.agentStatus,
      orderStatus: order.orderStatus,
    });
  } catch (error) {
    console.error("Error updating agent/order status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

//

  exports.toggleAvailability = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { status, location } = req.body;
    const io = req.app.get("io");

    if (!["AVAILABLE", "UNAVAILABLE"].includes(status)) {
      return res.status(400).json({ message: "Invalid availability status" });
    }

    // ✅ Convert location
    let geoLocation;
    if (location?.lat && location?.lng) {
      geoLocation = {
        type: "Point",
        coordinates: [location.lng, location.lat],
        accuracy: location.accuracy || 0,
      };
    } else if (
      location?.type === "Point" &&
      Array.isArray(location.coordinates) &&
      location.coordinates.length === 2
    ) {
      geoLocation = {
        type: "Point",
        coordinates: location.coordinates,
        accuracy: location.accuracy || 0,
      };
    } else {
      return res.status(400).json({
        message: "Invalid location. Provide either { lat, lng } or GeoJSON.",
      });
    }

    // ✅ Update Agent
    const updateData = {
      "agentStatus.availabilityStatus": status,
      "agentStatus.status": status === "AVAILABLE" ? "AVAILABLE" : "OFFLINE",
      location: geoLocation,
      updatedAt: new Date(),
    };

    const updatedAgent = await Agent.findByIdAndUpdate(agentId, updateData, { new: true });

    if (!updatedAgent) {
      return res.status(404).json({ message: "Agent not found" });
    }



    await sendNotificationToAdmins({
  title: "Agent Availability Update",
  body: `Agent ${updatedAgent.fullName || updatedAgent.phoneNumber} is now ${status}`,
  data: {
    agentId: updatedAgent._id.toString(),
    type: "AGENT_AVAILABILITY_CHANGE",
    status,
  },
});
    
    if (status === "AVAILABLE" && io) {
      io.emit("agentAvailable", {
        agentId: updatedAgent._id,
        location: updatedAgent.location,
      });
    }

    return res.status(200).json({
      message: "Agent status updated",
      data: {
        id: updatedAgent._id,
        status: updatedAgent.agentStatus,
        location: updatedAgent.location,
      },
    });
  } catch (error) {
    console.error("Error toggling agent availability:", error);
    return res.status(500).json({ error: "Server error while updating status" });
  }
};

exports.getAgentAvailabilityStatus = async (req, res) => {
  try {
    const { agentId } = req.params;

    const agent = await Agent.findById(agentId, {
      agentStatus: 1,
      location: 1,
    });

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    return res.status(200).json({
      status: agent.agentStatus,
      location: agent.location,
    });
  } catch (err) {
    console.error("Error fetching agent status:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.addAgentReview = async (req, res) => {
  const { agentId } = req.params;
  const { userId, orderId, rating, comment } = req.body;

  try {
    const order = await Order.findById(orderId);

    // Check if order exists and is completed
    if (!order || order.orderStatus !== "completed") {
      return res
        .status(400)
        .json({
          message: "You can only leave a review after delivery is completed.",
        });
    }

    // Optional: Check if the user leaving the review is the customer who made the order
    if (order.customerId.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "You are not allowed to review this order." });
    }

    const agent = await Agent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found." });
    }

    // Check for duplicate review on same order
    const alreadyReviewed = agent.feedback.reviews.some(
      (review) => review.orderId.toString() === orderId
    );
    if (alreadyReviewed) {
      return res
        .status(400)
        .json({ message: "You have already reviewed this order." });
    }

    // Add review
    agent.feedback.reviews.push({ userId, orderId, rating, comment });

    // Update average rating and total reviews
    const allRatings = agent.feedback.reviews.map((r) => r.rating);
    agent.feedback.totalReviews = allRatings.length;
    agent.feedback.averageRating =
      allRatings.reduce((a, b) => a + b, 0) / allRatings.length;

    await agent.save();

    res.status(200).json({ message: "Review added successfully!" });
  } catch (error) {
    console.error("Review Error:", error);

    res.status(500).json({ message: "Internal server error" });
  }
};

// getReviews

exports.getAgentReviews = async (req, res) => {
  const { agentId } = req.params;

  try {
    const agent = await Agent.findById(agentId)
      .select("feedback.reviews feedback.averageRating feedback.totalReviews")
      .populate("feedback.reviews.userId", "name") // Optional: reviewer name
      .populate("feedback.reviews.orderId", "orderTime"); // Optional: order info

    if (!agent) {
      return res.status(404).json({ message: "Agent not found." });
    }

    // Sort reviews by createdAt DESC (latest first)
    const sortedReviews = [...agent.feedback.reviews].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.status(200).json({
      averageRating: agent.feedback.averageRating,
      totalReviews: agent.feedback.totalReviews,
      reviews: sortedReviews,
    });
  } catch (error) {
    console.error("Fetch Agent Reviews Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateAgentBankDetails = async (req, res) => {
  try {
    const agentId = req.user.agentId;
    const { accountHolderName, accountNumber, ifscCode, bankName } = req.body;

    // Basic validation
    if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
      return res
        .status(400)
        .json({ message: "All bank details are required." });
    }

    // Find the agent
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found." });
    }

    // Update bank details and flag
    agent.bankAccountDetails = {
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
    };
    agent.bankDetailsProvided = true;

    await agent.save();

    return res
      .status(200)
      .json({ message: "Bank details updated successfully." });
  } catch (error) {
    console.error("Error updating bank details:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAgentEarnings = async (req, res) => {
  const { agentId } = req.params;
  try {
    const earnings = await AgentEarning.find({ agentId }).sort({
      createdAt: -1,
    });
    const totalEarnings = earnings.reduce(
      (acc, earning) => acc + earning.amount,
      0
    );
    const breakdown = {
      delivery_fee: 0,
      incentive: 0,
      penalty: 0,
      other: 0,
    };

    earnings.forEach((earning) => {
      breakdown[earning.type] += earning.amount;
    });
    res.json({
      totalEarnings,
      breakdown,
    });
  } catch (error) {
    console.error("Error fetching agent earnings:", error);
    res.status(500).json({ message: "Failed to fetch agent earnings" });
  }
};

// request for permission

exports.requestPermission = async (req, res) => {
  const { permission } = req.body;
  const agentId = req.user.agentId;

  const validPermissions = [
    "canChangeMaxActiveOrders",
    "canChangeCODAmount",
    "canAcceptOrRejectOrders",
  ];

  if (!validPermissions.includes(permission)) {
    return res.status(400).json({ error: "Invalid permission requested." });
  }

  const agent = await Agent.findById(agentId);

  if (!agent) {
    return res.status(404).json({ error: "Agent not found." });
  }

  const existingRequest = agent.permissionRequests.find(
    (req) => req.permissionType === permission && req.status === "Pending"
  );

  if (existingRequest) {
    return res
      .status(400)
      .json({
        error: "You already have a pending request for this permission.",
      });
  }

  agent.permissionRequests.push({ permissionType: permission });
  await agent.save();

  res.status(200).json({ message: "Permission request submitted." });
};

// get  permission requests of agent

exports.getMyPermissionRequests = async (req, res) => {
  const agent = await Agent.findById(req.user.agentId).select(
    "permissionRequests"
  );
  res.json(agent.permissionRequests);
};

// activate unlocked permissions
exports.activateUnlockedPermissions = async (req, res) => {
  const agentId = req.user.agentId;
  const agent = await Agent.findById(agentId);

  if (!agent) return res.status(404).json({ error: "Agent not found." });

  let updated = false;

  if (agent.canChangeMaxActiveOrders && agent.maxActiveOrders < 5) {
    agent.maxActiveOrders = 5;
    updated = true;
  }

  if (agent.canChangeCODAmount && agent.maxCODAmount < 3000) {
    agent.maxCODAmount = 3000;
    updated = true;
  }

  if (!updated) {
    return res
      .status(400)
      .json({ message: "No eligible changes or already upgraded." });
  }

  await agent.save();
  res.status(200).json({
    message: "Your values have been upgraded based on your permissions.",
    maxActiveOrders: agent.maxActiveOrders,
    maxCODAmount: agent.maxCODAmount,
  });
};

// Add or update agent device info
exports.addOrUpdateAgentDeviceInfo = async (req, res) => {
  try {
    const {
      agent,
      deviceId,
      os,
      osVersion,
      appVersion,
      model,
      batteryLevel,
      networkType,
      timezone,
      locationEnabled,
      isRooted,
    } = req.body;

    // Basic validation
    if (!agent || !deviceId) {
      return res.status(400).json({
        message: "agent and deviceId are required.",
        status: "failure",
      });
    }

    const updateData = {
      os,
      osVersion,
      appVersion,
      model,
      batteryLevel,
      networkType,
      timezone,
      locationEnabled,
      isRooted,
      updatedAt: new Date(),
    };

    const deviceInfo = await AgentDeviceInfo.findOneAndUpdate(
      { agent, deviceId },
      { $set: updateData },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      message: "Device info saved successfully.",
      status: "success",
      data: deviceInfo,
    });
  } catch (error) {
    console.error("Error saving agent device info:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      status: "failure",
    });
  }
};

exports.getAssignedOrders = async (req, res) => {
  try {
    const agentId = req.user._id;

    const orders = await Order.find({
      $or: [
        {
          agentCandidates: {
            $elemMatch: {
              agent: agentId,
              status: { $in: ["pending", "accepted"] },
            },
          },
        },
        {
          assignedAgent: agentId,
        },
      ],
      orderStatus: {
        $in: [
          "pending",
          "pending_agent_acceptance",
          "accepted_by_restaurant",
          "assigned_to_agent",
          "picked_up",
          "on_the_way",
          "in_progress",
          "arrived",
        ],
      },
    })
      .select(
        "orderStatus totalAmount deliveryAddress createdAt deliveryLocation orderItems paymentMethod scheduledTime instructions customerId restaurantId assignedAgent agentCandidates"
      )
      .sort({ createdAt: -1 })
      .populate("restaurantId", "name address location")
      .populate("customerId", "name phone email");

    // 👇 Clean and DRY
    const formattedOrders = orders.map((order) => formatOrder(order, agentId));

    return res.status(200).json({
      status: "success",
      assignedOrders: formattedOrders,
    });
  } catch (error) {
    console.error("❌ Error fetching assigned orders:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch assigned orders",
      error: error.message,
    });
  }
};


// GET /agent/warnings   
exports.agentWarnings = async (req, res) => {
  const agentId = req.user._id;
  const agent = await Agent.findById(agentId)
  if (!agent) return res.status(404).json({ message: "Agent not found." });

  return res.json({ warnings: agent.warnings || [] });
};


// GET /agent/termination
exports.agentTerminationInfo = async (req, res) => {
  const agentId = req.user._id;
  const agent = await Agent.findOne(agentId)
  if (!agent) return res.status(404).json({ message: "Agent not found." });

  if (!agent.termination?.terminated)
    return res.status(404).json({ message: "No termination found." });

  return res.json({ termination: agent.termination });
};


exports.agentAcceptOrRejectOrder = async (req, res) => {
  try {
    const agentId = req.user._id;
    const { action, reason } = req.body;
    const { orderId } = req.params;

    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({
        status: "error",
        message: 'Invalid action. Use "accept" or "reject".',
      });
    }

    const order = await Order.findById(orderId);

    console.log(order)

    if (!order) {
      return res.status(404).json({
        status: "error",
        message: "Order not found",
      });
    }

    // ✅ Enforce one-by-one flow
    const nextPending = order.agentCandidates.find(
      (c) => c.status === "pending"
    );
    if (!nextPending || nextPending.agent.toString() !== agentId.toString()) {
      return res.status(403).json({
        status: "error",
        message: "You are not the active candidate for this order",
      });
    }

    const candidateIndex = order.agentCandidates.findIndex(
      (c) => c.agent.toString() === agentId.toString()
    );

    if (action === "accept") {
      order.agentCandidates[candidateIndex].status = "accepted";
      order.agentCandidates[candidateIndex].respondedAt = new Date();
      order.assignedAgent = agentId;
      order.agentAssignmentStatus = "accepted_by_agent";
      order.agentAcceptedAt = new Date();
       await order.save();
    }

    // 🔁 If rejected, trigger next candidate allocation here if needed
    if (action === "reject") {
      order.agentCandidates[candidateIndex].status = "rejected";
      order.agentCandidates[candidateIndex].respondedAt = new Date();

      order.rejectionHistory.push({
        agentId,
        rejectedAt: new Date(),
        reason: reason || "Not specified",
      });
      order.agentAssignmentStatus = "rejected_by_agent";

      await order.save();

      // 🔁 Notify next agent (waiting ➝ pending)
      await notifyNextPendingAgent(order);
    }

    return res.status(200).json({
      status: "success",
      message: `Order ${action}ed successfully`,
    });
  } catch (error) {
    console.error("❌ Error in agentAcceptOrRejectCandidateOrder:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

exports.getAssignedOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const agentId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const order = await Order.findById(orderId)
      .populate("restaurantId", "name address location phone")
      .populate("customerId", "name phone email")
      .populate("orderItems.productId");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const formattedOrder = formatOrder(order, agentId); // 👈 use utility

    return res.status(200).json({
      status: "success",
      order: formattedOrder,
    });
  } catch (error) {
    console.error("❌ Error in getAssignedOrderDetails:", error);
    return res.status(500).json({
      status: "error",
      message: "Something went wrong",
      error: error.message,
    });
  }
};

const deliveryFlow = [
  "awaiting_start",
  "start_journey_to_restaurant",
  "reached_restaurant",
  "picked_up",
  "out_for_delivery",
  "reached_customer",
  "delivered",
];

exports.updateAgentDeliveryStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const agentId = req.user._id;
    const { status } = req.body;

    const validStatuses = [...deliveryFlow, "cancelled"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid delivery status" });
    }

    const order = await Order.findById(orderId)
      .populate("customerId")
      .populate("restaurantId")
      .populate("orderItems.productId");

    if (!order) return res.status(404).json({ message: "Order not found" });

    console.log("Assigned Agent:", order.assignedAgent?.toString());
    console.log("Request Agent:", agentId.toString());
    if (order.assignedAgent?.toString() !== agentId.toString()) {
      return res
        .status(403)
        .json({ message: "You are not assigned to this order" });
    }

    const currentIndex = deliveryFlow.indexOf(order.agentDeliveryStatus);
    const newIndex = deliveryFlow.indexOf(status);

    if (status !== "cancelled" && newIndex !== currentIndex + 1) {
      return res.status(400).json({
        message: `Invalid step transition: can't move from ${order.agentDeliveryStatus} to ${status}`,
      });
    }

    order.agentDeliveryStatus = status;
    await order.save();

    const response = formatOrder(order, agentId);

    res.status(200).json({
      message: "Delivery status updated",
      order: response,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getAgentNotifications = async (req, res) => {
  try {
    const { agentId } = req.params;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: "agentId is required",
      });
    }

    const notifications = await AgentNotification.find({ agentId }).sort({
      sentAt: -1,
    }); // latest first

    res.json({
      success: true,
      message: "Notifications fetched successfully",
      data: notifications,
    });
  } catch (error) {
    console.error("❌ Error fetching agent notifications:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteAgentNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: "Notification ID is required",
      });
    }

    const deleted = await AgentNotification.findByIdAndDelete(notificationId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting notification:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.markAgentNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: "Notification ID is required",
      });
    }

    const notification = await AgentNotification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    if (notification.read) {
      return res.status(200).json({
        success: true,
        message: "Notification already marked as read",
      });
    }

    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    console.error("❌ Error marking notification as read:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};





exports.getAgentHomeData = async (req, res) => {
  try {
    // Mock data (this would normally come from DB queries)
    const mockData = {
      currentTask: {
        orderId: "ORD12978",
        restaurantName: "Gokul Hotel",
        customerName: "Amarnadhs",
        agentDeliveryStatus: "awaiting_start", // pickup_pending, on_route, delivered
      },

      dailySummary: {
        totalDeliveries: 7,
        earnings: 520,
        distanceTravelledKm: 12.4,
        rating: 4.6,
        notificationCount: 3,
      },

      orderSummary: {
        totalOrders: 12,
        newOrders: 3,
        rejectedOrders: 2,
      }
    };

    return res.status(200).json({
      status: "success",
      data: mockData
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch agent home data",
      error: err.message
    });
  }
};
// Apply for leave\
exports.applyLeave = async (req, res) => {
  try {
    const agentId = req.user._id; 
    const { leaveStartDate, leaveEndDate, leaveType, reason } = req.body;

    // Basic validations
    if (!leaveStartDate || !leaveEndDate || !leaveType)
      return res.status(400).json({ message: "Missing required fields" });

    if (new Date(leaveStartDate) > new Date(leaveEndDate))
      return res.status(400).json({ message: "Start date cannot be after end date" });

    const agent = await Agent.findById(agentId);

    // Optional: Check for overlapping leaves
    const hasOverlap = agent.leaves.some(leave =>
      (new Date(leave.leaveStartDate) <= new Date(leaveEndDate)) &&
      (new Date(leave.leaveEndDate) >= new Date(leaveStartDate))
    );

    if (hasOverlap) {
      return res.status(409).json({ message: "Leave request overlaps with existing leave" });
    }

    agent.leaves.push({
      leaveStartDate,
      leaveEndDate,
      leaveType,
      reason: reason || "", // optional field
      status: "Pending",
      appliedAt: new Date()
    });

    await agent.save();

    res.status(200).json({ message: "Leave request submitted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};



// check leave status

exports.getLeaveStatus = async (req, res) => {
  try {
    const agentId = req.user._id;

    const agent = await Agent.findById(agentId).select("leaves");

    if (!agent)
      return res.status(404).json({ message: "Agent not found" });

    const sortedLeaves = (agent.leaves || []).sort((a, b) => new Date(b.leaveStartDate) - new Date(a.leaveStartDate));

    res.status(200).json({
      message: "Leave status retrieved successfully",
      total: sortedLeaves.length,
      leaves: sortedLeaves,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};







exports.uploadSelfie = async (req, res) => {
  try {
    const agentId = req.user._id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const existing = await AgentSelfie.findOne({
      agentId,
      takenAt: { $gte: startOfDay }
    });

    if (existing) {
      return res.status(400).json({ message: 'Selfie already submitted for today.' });
    }

    const uploadResult = await uploadOnCloudinary(file.path, 'agent_selfies');

    if (!uploadResult?.secure_url) {
      return res.status(500).json({ message: 'Failed to upload selfie.' });
    }

    const selfie = await AgentSelfie.create({
      agentId,
      imageUrl: uploadResult.secure_url
    });

    return res.json({ message: 'Selfie submitted successfully.', selfie });

  } catch (err) {
    console.error("Upload Selfie Error:", err);
    res.status(500).json({ message: 'Server error' });
  }
};



exports.getSelfieStatus = async (req, res) => {
  try {
    const agentId = req.user._id;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const selfie = await AgentSelfie.findOne({
      agentId,
      takenAt: { $gte: startOfDay },
    });

    if (selfie) {
      return res.json({
        selfieRequired: false,
        message: 'Selfie already submitted for today',
        selfie,
      });
    } else {
      return res.json({
        selfieRequired: true,
        message: 'Selfie is required for today',
      });
    }
  } catch (error) {
    console.error('Get selfie status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};



exports.agentLogout = async (req, res) => {
  try {
    const agentId = req.user._id; // Comes from protectAgent middleware
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ message: "Missing FCM token" });
    }

    const agent = await Agent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    const initialTokenCount = agent.fcmTokens.length;

    agent.fcmTokens = agent.fcmTokens.filter(
      (t) => t.token !== fcmToken
    );

    const tokenRemoved = agent.fcmTokens.length !== initialTokenCount;

    if (!tokenRemoved) {
      return res.status(404).json({ message: "FCM token not found" });
    }

    await agent.save();

    return res.status(200).json({ message: "Logout successful. FCM token removed." });
  } catch (error) {
    console.error("Error during agent logout:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};


exports.getAgentBasicDetails= async (req, res) => {
  try {
    const { agentId } = req.params;

    const agent = await Agent.findById(agentId).select(
      `
        fullName phoneNumber email profilePicture
        dashboard totalDeliveries totalCollections totalEarnings tips surge incentives
        points totalPoints lastAwardedDate
        bankDetailsProvided payoutDetails
        qrCode role agentStatus attendance feedback.applicationStatus
        agentApplicationDocuments
        permissions codTracking
      `
    );

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        fullName: agent.fullName,
        phoneNumber: agent.phoneNumber,
        email: agent.email,
        profilePicture: agent.profilePicture,
        dashboard: agent.dashboard || {},
        points: agent.points || {},
        bankDetailsProvided: agent.bankDetailsProvided,
        payoutDetails: agent.payoutDetails || {},
        qrCode: agent.qrCode || null,
        role: agent.role,
        agentStatus: agent.agentStatus || {},
        attendance: {
          daysWorked: agent.attendance?.daysWorked || 0,
          daysOff: agent.attendance?.daysOff || 0,
        },
        feedback: {
          averageRating: agent.feedback?.averageRating || 0,
          totalReviews: agent.feedback?.totalReviews || 0,
        },
        applicationStatus: agent.applicationStatus,
        documents: agent.agentApplicationDocuments || {},
        permissions: agent.permissions || {},
        codTracking: agent.codTracking || {},
      },
    });
  } catch (error) {
    console.error('Error fetching agent profile:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};



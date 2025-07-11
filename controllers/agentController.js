const Agent = require('../models/agentModel');
const AgentEarning = require("../models/AgentEarningModel")
const Order = require('../models/orderModel');
const User = require("../models/userModel");
const Session = require("../models/session");
const Restaurant = require("../models/restaurantModel");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose')
const {addAgentEarnings,addRestaurantEarnings ,createRestaurantEarning} = require("../services/earningService")
const { uploadOnCloudinary } = require('../utils/cloudinary');
const { findAndAssignNearestAgent } = require('../services/findAndAssignNearestAgent');
const { sendPushNotification } = require('../utils/sendPushNotification');

exports.registerAgent = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const phoneRegex = /^(\+91)?[6-9]\d{9}$/;

    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: "Invalid phone number format. Must be a 10-digit Indian number, with or without +91" });
    }


    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (password.length < 6 || !/\d/.test(password)) {
      return res.status(400).json({
        message: "Password must be at least 6 characters and include a number",
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Upload documents and profile picture
    const license = req.files?.license?.[0];
    const insurance = req.files?.insurance?.[0];
    const profilePicture = req.files?.profilePicture?.[0];

    let licenseUrl = "", insuranceUrl = "", profilePicUrl = "";

    if (license) {
      const result = await uploadOnCloudinary(license.path);
      licenseUrl = result?.secure_url;
    }

    if (insurance) {
      const result = await uploadOnCloudinary(insurance.path);
      insuranceUrl = result?.secure_url;
    }

    if (profilePicture) {
      const result = await uploadOnCloudinary(profilePicture.path);
      profilePicUrl = result?.secure_url;
    }

    let location = null;
    try {
      if (req.body.location) {
        location = JSON.parse(req.body.location);

        if (
          location.type !== "Point" ||
          !Array.isArray(location.coordinates) ||
          location.coordinates.length !== 2
        ) {
          return res.status(400).json({ message: "Invalid location format. Must be GeoJSON with type 'Point' and two coordinates." });
        }
      } else {
        return res.status(400).json({ message: "Location is required" });
      }
    } catch (err) {
      return res.status(400).json({ message: "Invalid location JSON format" });
    }
    console.log("Parsed location:", location);


    // Create user with agent application info
    const newUser = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      userType: "customer",
      isAgent: false,
      agentApplicationStatus: "pending",
      profilePicture: profilePicUrl || null,
      agentApplicationDocuments: {
        license: licenseUrl || null,
        insurance: insuranceUrl || null,
        submittedAt: new Date(),
      },
    });

    await newUser.save();

    res.status(201).json({
      message: "Agent application submitted. Pending approval.",
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        agentApplicationStatus: newUser.agentApplicationStatus,
      },
    });
  } catch (error) {
    console.error("Agent registration error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};




exports.loginAgent = async (req, res) => {
  try {
    const { identifier, password } = req.body;

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

    const user = await User.findOne(
      isEmail ? { email: identifier } : { phone: identifier }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.agentApplicationStatus !== "approved" || user.userType !== "agent") {
      return res.status(403).json({ message: "Agent not approved yet" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    const token = jwt.sign(
      { userId: user._id, userType: user.userType },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Max 1 sessions limit
    const MAX_SESSIONS = 1;
    const existingSessions = await Session.find({ userId: user._id }).sort({ createdAt: 1 });

    if (existingSessions.length >= MAX_SESSIONS) {
      const oldestSession = existingSessions[0];
      await Session.findByIdAndDelete(oldestSession._id); // Kick out oldest session
    }

    // Optional: track device + IP info
    const userAgent = req.headers["user-agent"] || "Unknown Device";
    const ip = req.ip || req.connection.remoteAddress || "Unknown IP";

    await Session.create({
      userId: user._id,
      token,
      userAgent,
      ip,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        profilePicture: user.profilePicture,
        agentApplicationDocuments: user.agentApplicationDocuments,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
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
      return res.status(400).json({ error: "This order is not assigned to you" });

    if (order.orderStatus !== 'pending_agent_acceptance')
      return res.status(400).json({ error: "This order doesn't require acceptance" });

    const io = req.app.get("io");

    if (response === 'accept') {
      await Order.findByIdAndUpdate(orderId, {
        orderStatus: 'assigned_to_agent',
        agentAcceptedAt: new Date()
      });

      await Agent.findByIdAndUpdate(agentId, {
        'deliveryStatus.status': 'in_progress',
        $addToSet: { 'deliveryStatus.currentOrderIds': orderId }
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
      io.to(`restaurant_${order.restaurantId.toString()}`).emit("agentAssigned", {
        agentId,
        orderId,
      });

      // Send push notifications
      await sendPushNotification(order.customerId, "Order Accepted", "Your delivery is now on the way!");
      await sendPushNotification(order.restaurantId, "Agent Accepted", "An agent accepted the order and is on the way.");

      return res.json({ message: "Order accepted successfully" });

    } else if (response === 'reject') {
      await Order.findByIdAndUpdate(orderId, {
        assignedAgent: null,
        orderStatus: 'awaiting_agent_assignment',
        $push: {
          rejectionHistory: {
            agentId,
            rejectedAt: new Date()
          }
        }
      });

      await Agent.findByIdAndUpdate(agentId, {
        $inc: { 'deliveryStatus.currentOrderCount': -1 },
        $pull: { 'deliveryStatus.currentOrderIds': orderId },
      });


      const newAgent = await findAndAssignNearestAgent(
        orderId,
        {
          longitude: order.location.coordinates[0],
          latitude: order.location.coordinates[1]
        }
      );

      if (!newAgent) {
        return res.json({
          message: "Order rejected. No other agents currently available",
          orderStatus: 'awaiting_agent_assignment'
        });
      }

      const newStatus = newAgent.permissions.canAcceptOrRejectOrders
        ? 'pending_agent_acceptance'
        : 'assigned_to_agent';

      await Order.findByIdAndUpdate(orderId, {
        assignedAgent: newAgent._id,
        orderStatus: newStatus
      });

      // If no acceptance needed, start tracking immediately
      if (!newAgent.permissions.canAcceptOrRejectOrders) {
        io.to(`agent_${newAgent._id.toString()}`).emit("startDeliveryTracking", {
          orderId,
          customerId: order.customerId,
          restaurantId: order.restaurantId,
        });

        io.to(`user_${order.customerId.toString()}`).emit("agentAssigned", {
          agentId: newAgent._id,
          orderId,
        });

        io.to(`restaurant_${order.restaurantId.toString()}`).emit("agentAssigned", {
          agentId: newAgent._id,
          orderId,
        });

        await sendPushNotification(order.customerId, "New Agent Assigned", "A new agent has been auto-assigned to your order.");
        await sendPushNotification(order.restaurantId, "Agent Reassigned", "A new agent has been assigned to the order.");
      }

      return res.json({
        message: "Order rejected and reassigned to another agent",
        newAgent: newAgent.fullName,
        orderStatus: newStatus
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
    "on_the_way"
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
      "assigned_to_agent": "ORDER_ASSIGNED",
      "picked_up": "PICKED_UP",
      "in_progress": "ON_THE_WAY",
      "arrived": "AT_CUSTOMER_LOCATION",
      "delivered": "AVAILABLE"
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
      "delivered"
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
      "delivered"
    ];
    if (notifyCustomerStatuses.includes(newStatus)) {
      io.to(`user_${order.customerId._id}`).emit("order_status_update", {
        orderId,
        newStatus,
        timestamp: new Date()
      });
    }

    // If delivered — handle restaurant earning and agent free notification
    if (newStatus === "delivered") {
      try {
        await createRestaurantEarning(order);
      } catch (err) {
        console.error("Error creating restaurant earning:", err);
      }

      io.to(`restaurant_${order.restaurantId._id}`).emit("agent_status_update", {
        agentId,
        activityStatus: "Free",
        orderId,
        timestamp: new Date()
      });
    }

    res.status(200).json({
      message: "Agent order status updated successfully",
      agentStatus: agent.agentStatus,
      orderStatus: order.orderStatus
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

    // Validate availability status (UPPERCASE)
    if (!["AVAILABLE", "UNAVAILABLE"].includes(status)) {
      return res.status(400).json({ message: "Invalid availability status" });
    }

    // Validate location format
    if (
      !location ||
      location.type !== "Point" ||
      !Array.isArray(location.coordinates) ||
      location.coordinates.length !== 2 ||
      typeof location.coordinates[0] !== "number" ||
      typeof location.coordinates[1] !== "number" ||
      isNaN(location.coordinates[0]) ||
      isNaN(location.coordinates[1])
    ) {
      return res.status(400).json({
        message: "Invalid location format. Must be GeoJSON Point with numeric coordinates.",
      });
    }

    // Prepare update data
    const updateData = {
      'agentStatus.availabilityStatus': status,
      location: {
        type: "Point",
        coordinates: location.coordinates,
      },
      updatedAt: new Date(),
    };

    // Ensure operational status matches availability state
    updateData['agentStatus.status'] = (status === "AVAILABLE") ? "AVAILABLE" : "OFFLINE";

    // Update agent
    const updatedAgent = await Agent.findByIdAndUpdate(
      agentId,
      updateData,
      { new: true }
    );

    if (!updatedAgent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    // Emit Socket event to relevant clients if needed
    if (status === "AVAILABLE") {
      // Example: emit availability event
      // io.emit("agentAvailable", { agentId, location });
    }

    return res.status(200).json({
      message: "Agent availability and location updated successfully",
      agent: updatedAgent,
    });
  } catch (error) {
    console.error("Error toggling agent availability:", error);
    res.status(500).json({ error: "Server error while toggling agent availability" });
  }
};
exports.addAgentReview = async (req, res) => {
  const { agentId } = req.params;
  const { userId, orderId, rating, comment } = req.body;

  try {
    const order = await Order.findById(orderId);

    // Check if order exists and is completed
    if (!order || order.orderStatus !== "completed") {
      return res.status(400).json({ message: "You can only leave a review after delivery is completed." });
    }

    // Optional: Check if the user leaving the review is the customer who made the order
    if (order.customerId.toString() !== userId) {
      return res.status(403).json({ message: "You are not allowed to review this order." });
    }

    const agent = await Agent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found." });
    }

    // Check for duplicate review on same order
    const alreadyReviewed = agent.feedback.reviews.some(
      review => review.orderId.toString() === orderId
    );
    if (alreadyReviewed) {
      return res.status(400).json({ message: "You have already reviewed this order." });
    }

    // Add review
    agent.feedback.reviews.push({ userId, orderId, rating, comment });

    // Update average rating and total reviews
    const allRatings = agent.feedback.reviews.map(r => r.rating);
    agent.feedback.totalReviews = allRatings.length;
    agent.feedback.averageRating = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;

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
      .select('feedback.reviews feedback.averageRating feedback.totalReviews')
      .populate('feedback.reviews.userId', 'name') // Optional: reviewer name
      .populate('feedback.reviews.orderId', 'orderTime'); // Optional: order info

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
      reviews: sortedReviews
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
      return res.status(400).json({ message: "All bank details are required." });
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

    return res.status(200).json({ message: "Bank details updated successfully." });

  } catch (error) {
    console.error("Error updating bank details:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};


exports.getAgentEarnings = async (req,res)  => {
  const { agentId } = req.params;
  try {
        const earnings = await AgentEarning.find({ agentId }).sort({ createdAt: -1 }); 
       const totalEarnings = earnings.reduce((acc, earning) => acc + earning.amount, 0);
 const breakdown = {
      delivery_fee: 0,
      incentive: 0,
      penalty: 0,
      other: 0
    };

    earnings.forEach(earning => {
      breakdown[earning.type] += earning.amount;
    });
         res.json({
      totalEarnings,
      breakdown
    });
    
  } catch (error) {
console.error("Error fetching agent earnings:", error);
    res.status(500).json({ message: "Failed to fetch agent earnings" });
  }

}

// request for permission

exports.requestPermission = async (req, res) => {
  const { permission } = req.body;
  const agentId = req.user.agentId;

  const validPermissions = [
    "canChangeMaxActiveOrders",
    "canChangeCODAmount",
    "canAcceptOrRejectOrders"
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
    return res.status(400).json({ error: "You already have a pending request for this permission." });
  }

  agent.permissionRequests.push({ permissionType: permission });
  await agent.save();

  res.status(200).json({ message: "Permission request submitted." });
};


// get  permission requests of agent

exports.getMyPermissionRequests = async (req, res) => {
  const agent = await Agent.findById(req.user.agentId).select("permissionRequests");
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
    return res.status(400).json({ message: "No eligible changes or already upgraded." });
  }

  await agent.save();
  res.status(200).json({
    message: "Your values have been upgraded based on your permissions.",
    maxActiveOrders: agent.maxActiveOrders,
    maxCODAmount: agent.maxCODAmount,
  });
};

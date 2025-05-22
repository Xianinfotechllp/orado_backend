const Agent = require('../models/agentModel');
const Order = require('../models/orderModel');
const User = require("../models/userModel");
const Session = require("../models/session");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose')

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





exports.agentAcceptsOrder = async (req, res) => {
  try {
    const agentId = req.body.agentId;
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }
    if (!agentId) {
      return res.status(400).json({ message: "Agent ID is required", messageType: "failure" });
    }

    // Validate agent existence and active status
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (!agent.active) {
      return res.status(403).json({ error: 'Agent is not active' });
    }

    // Fetch the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.orderStatus !== 'accepted_by_restaurant') {
      return res.status(400).json({
        error: `Cannot accept order. Current status is: ${order.orderStatus}`,
      });
    }

    // Assign agent and update order status
    order.orderStatus = 'assigned_to_agent';
    order.assignedAgent = agentId;

    await order.save();

    res.status(200).json({
      message: 'Order successfully accepted by agent',
      order,
    });

  } catch (error) {
    console.error('Agent Accept Order Error:', error);
    res.status(500).json({ error: 'Something went wrong while accepting the order' });
  }
};



exports.agentRejectsOrder = async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const { orderId, rejectionReason } = req.body;

    // Validate input
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    // Fetch the order
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Ensure order is in 'accepted_by_restaurant' status
    if (order.orderStatus !== 'accepted_by_restaurant') {
      return res.status(400).json({
        error: `Cannot reject order. Current status is: ${order.orderStatus}`,
      });
    }

    // Update status to cancelled_by_agent and optionally store rejection reason
    order.orderStatus = 'cancelled_by_agent';
    order.cancellationReason = rejectionReason || 'Rejected by agent';
    order.assignedAgent = null;

    await order.save();

    res.status(200).json({
      message: 'Order successfully rejected by agent',
      order,
    });

  } catch (error) {
    console.error('Agent Reject Order Error:', error);
    res.status(500).json({ error: 'Something went wrong while rejecting the order' });
  }
};


exports.agentUpdatesOrderStatus = async (req, res) => {
  try {
    const { agentId, orderId } = req.params;
    const { status } = req.body;
    const io = req.app.get('io');

    // Validate required fields
    if (!agentId || !orderId || !status) {
      return res.status(400).json({ error: "agentId, orderId, and status are required" });
    }

    // Validate orderId format
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: "Invalid orderId format" });
    }

    // Validate status
    const allowedStatuses = ['picked_up', 'on_the_way', 'arrived', 'delivered'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    // Find order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Check if the agent updating the status is assigned to this order
    if (!order.assignedAgent || order.assignedAgent.toString() !== agentId) {
      return res.status(403).json({ error: "You are not assigned to this order" });
    }

    // Update status
    order.orderStatus = status;
    await order.save();

    // Emit real-time notification to clients
    io.emit("orderstatus", { message: "Order status updated", order });

    // Award points if delivered
    if (status === "delivered") {
      await awardDeliveryPoints(agentId); // assuming this is defined elsewhere
    }

    return res.status(200).json({ message: "Order status updated successfully", order });

  } catch (error) {
    console.error("Error updating order status", error);
    res.status(500).json({ error: "Server error while updating order status" });
  }
};
exports.toggleAvailability = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!["Available", "Unavailable"].includes(status)) {
      return res.status(400).json({ message: "Invalid availability status" });
    }

    // 1. Find the user by userId
    const user = await User.findById(userId);

    if (!user || !user.agentId) {
      return res.status(404).json({ message: "Agent not linked to user or user not found" });

    }

    return res.status(200).json({ message: "Order status updated successfully", order });

  } catch (error) {
    console.error("Error updating order status", error);
    res.status(500).json({ error: "Server error while updating order status" });
  }
};


exports.addAgentReview = async (req, res) => {
  const { agentId } = req.params;
  const { userId, orderId, rating, comment } = req.body;

  try {
    const order = await Order.findById(orderId);

    // Check if order exists and is delivered
    if (!order || order.orderStatus !== "delivered") {
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
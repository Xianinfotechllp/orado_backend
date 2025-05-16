const Agent = require('../models/agentModel');
const Order = require('../models/orderModel');
const User = require("../models/userModel");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose')
const { uploadOnCloudinary } = require('../utils/cloudinary');
const fs = require('fs');

exports.registerAgent = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: "Invalid phone number" });
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
    const isPhone = /^[6-9]\d{9}$/.test(identifier);

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




exports.agentAcceptsOrder = async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const { orderId } = req.body;

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
        error: `Cannot accept order. Current status is: ${order.orderStatus}`,
      });
    }

    // Assign the agent and update order status
    order.orderStatus = 'assigned_to_agent';
    order.assignedAgent = agentId; // assuming this field exists in your schema

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

       console.log(agentId, orderId, status)
    // Check if agentId, orderId, and status are provided
    if (!agentId || !orderId || !status) {
      return res.status(400).json({ error: "agentId, orderId, and status are required" });
    }

    // Validate orderId format (if using MongoDB ObjectId)
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: "Invalid orderId format" });
    }

    // Validate status value
   const allowedStatuses = [
  'picked_up',   // Agent collected the order
  'on_the_way',  // Agent started delivery
  'arrived',     // Agent reached customer location
  'delivered'    // Order handed over
];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // // Check if agent is assigned to this order
    // if (order.assignedAgent.toString() !== agentId) {
    //   return res.status(403).json({ error: "You are not assigned to this order" });
    // }

    // Update status
    order.orderStatus = status;
          // Emit notification to all connected clients
  io.emit("orderstatus", { message: "New Order Placed!",date:order });
    await order.save();

    return res.status(200).json({ message: "Order status updated successfully", order });

  } catch (error) {
    console.error("Error updating order status", error);
    res.status(500).json({ error: "Server error while updating order status" });
  }
};

// document upload
exports.uploadDocuments = async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = await Agent.findById(agentId);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    const updates = {};

    if (req.files['license']) {
      const result = await uploadOnCloudinary(req.files['license'][0].path);
      if (result?.secure_url) updates['documents.license'] = result.secure_url;
    }

    if (req.files['insurance']) {
      const result = await uploadOnCloudinary(req.files['insurance'][0].path);
      if (result?.secure_url) updates['documents.insurance'] = result.secure_url;
    }

    await Agent.findByIdAndUpdate(agentId, { $set: updates }, { new: true });

    res.status(200).json({ message: "Documents uploaded successfully", documents: updates });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ message: "Failed to upload documents" });
  }
};

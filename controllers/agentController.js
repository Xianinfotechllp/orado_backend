const Agent = require('../models/agentModel');
const Order = require('../models/orderModel');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose')

exports.registerAgent = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      password,
      address,
      vehicleDetails,
      bankDetails
    } = req.body;

    // Basic validation
    if (!name || !phone || !email || !password || !address) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    // Phone number validation
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: 'Invalid phone number' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Password validation
    if (password.length < 6 || !/\d/.test(password)) {
      return res.status(400).json({ message: 'Password must be at least 6 characters and contain a number' });
    }

    // Address validation
    if (address.length < 5) {
      return res.status(400).json({ message: 'Address must be at least 5 characters long' });
    }

    // Vehicle Details validation
    if (!vehicleDetails || !vehicleDetails.type || !vehicleDetails.number) {
      return res.status(400).json({ message: 'Vehicle details are required' });
    }
    const allowedVehicleTypes = ['Bike', 'Car', 'Cycle'];
    if (!allowedVehicleTypes.includes(vehicleDetails.type)) {
      return res.status(400).json({ message: 'Invalid vehicle type' });
    }
    const vehicleNumberRegex = /^[A-Z]{2}\d{2}[A-Z]{2}\d{4}$/;
    if (!vehicleNumberRegex.test(vehicleDetails.number)) {
      return res.status(400).json({ message: 'Invalid vehicle number format (eg: TS09AB1234)' });
    }

    // Bank Details validation
    if (!bankDetails || !bankDetails.accountNumber || !bankDetails.ifscCode || !bankDetails.bankName) {
      return res.status(400).json({ message: 'Bank details are required' });
    }
    if (bankDetails.bankName.length < 3) {
      return res.status(400).json({ message: 'Bank name must be at least 3 characters' });
    }

    // Check if agent already exists
    const existingAgent = await Agent.findOne({ phone });
    if (existingAgent) {
      return res.status(400).json({ message: 'Agent already registered with this phone' });
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new agent
    const newAgent = new Agent({
      name,
      phone,
      email,
      password: hashedPassword, // store hashed password
      address,
      vehicleDetails,
      bankDetails
    });

    await newAgent.save();

    res.status(201).json({
      message: 'Agent registered successfully',
      agent: {
        _id: newAgent._id,
        name: newAgent.name,
        phone: newAgent.phone,
        email: newAgent.email
      }
    });

  } catch (error) {
    console.error('Agent Registration Error:', error);
    res.status(500).json({ message: 'Something went wrong', error: error.message });
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

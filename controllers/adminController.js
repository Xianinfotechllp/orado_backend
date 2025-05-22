const User = require("../models/userModel");
const Agent = require("../models/agentModel");
const Session = require("../models/session");
const Permission = require('../models/restaurantPermissionModel');
const Restaurant = require("../models/restaurantModel");
const ChangeRequest = require("../models/changeRequest");
const Product = require("../models/productModel");
const Category = require("../models/categoryModel");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendSms } = require("../utils/sendSms")

exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Find user
    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found");
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 2. Check if user is admin
    if (user.userType !== "admin" && user.userType !== "superAdmin") {
      return res.status(403).json({ message: "Access denied. Not an admin." });
    }

    // 3. Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    
    
    if (!isMatch) {
      console.log("Password Match:", isMatch);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 4. Create JWT token
    const token = jwt.sign(
      { userId: user._id, userType: user.userType },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Limit to 3 active sessions
    const MAX_SESSIONS = 3;
    const existingSessions = await Session.find({ userId: user._id }).sort({ createdAt: 1 });

    if (existingSessions.length >= MAX_SESSIONS) {
      const oldestSession = existingSessions[0];
      await Session.findByIdAndDelete(oldestSession._id); // Kick the oldest session out
    }

    // Get device + IP info 
    const userAgent = req.headers["user-agent"] || "Unknown Device";
    const ip = req.ip || req.connection.remoteAddress || "Unknown IP";

    // Save new session in DB
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
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
      },
    });
  } catch (error) {
    console.error("Admin Login Error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Logout user by deleting session

exports.logoutAdmin = async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(400).json({ message: "Token required" });

  await Session.findOneAndDelete({ token });
  res.json({ message: "Logged out successfully" });
};

// logout from all devices

exports.logoutAll = async (req, res) => {
  await Session.deleteMany({ userId: req.user._id });
  res.json({ message: "Logged out from all sessions" });
};

// get requests for agent approval

exports.getPendingAgentRequests = async (req, res) => {
  try {
    const pendingRequests = await User.find({ agentApplicationStatus: "pending" })
      .sort({ createdAt: -1 }) // Newest first
      .select("-password -resetPasswordToken -resetPasswordExpires") // Exclude sensitive info
      .lean();

    res.status(200).json({
      success: true,
      message: "Pending agent requests fetched successfully.",
      data: pendingRequests,
    });
  } catch (error) {
    console.error("Error fetching pending agent requests:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong while fetching requests.",
    });
  }
};

exports.approveAgentApplication = async (req, res) => {
  try {
    const { userId } = req.params;
    const { action } = req.body; // Should be "approve" or "reject"

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "Invalid action. Use 'approve' or 'reject'." });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.agentApplicationStatus !== "pending") {
      return res.status(400).json({ message: "No pending application for this user." });
    }

    let agentId = null;

    if (action === "approve") {
      const newAgent = new Agent({
        userId: user._id,
        fullName: user.name,
        phoneNumber: user.phone,
        email: user.email,
        profilePicture: user.profilePicture,
        documents: {
          license: user.agentApplicationDocuments.license,
          insurance: user.agentApplicationDocuments.insurance,
        },
        bankDetailsProvided: false,
        bankAccountDetails: null,
        isApproved: true
      });

      await newAgent.save();

      user.agentApplicationStatus = "approved";
      user.isAgent = true;
      user.agentId = newAgent._id;
      user.userType = "agent";
      agentId = newAgent._id;
    } else {
      user.agentApplicationStatus = "rejected";
    }

    await user.save();

    // ✅ Send SMS
    const message = `Hello ${user.name}, your agent application has been ${user.agentApplicationStatus.toUpperCase()}.`;
    if (user.phone) {
      await sendSms(user.phone, message);
    }

    res.status(200).json({
      message: `Agent application has been ${action} and user notified.`,
      ...(action === "approve" && { agentId, bankDetailsProvided: false })
    });

  } catch (error) {
    console.error("Agent approval error:", error);
    res.status(500).json({ message: "Server error" });
  }
};



// get pending merchant requests

exports.getPendingMerchants = async (req, res) => {
  try {
    const pendingMerchants = await User.find({
      userType: "merchant",
      "merchantApplication.status": "pending"
    }).select("-password"); // Don't return passwords, obviously

    res.status(200).json({ merchants: pendingMerchants });
  } catch (err) {
    console.error("Error fetching pending merchants:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// approve or reject merchant application
exports.updateMerchantStatus = async (req, res) => {
  try {
    const { userId } = req.params; // This is merchant ID, not admin ID
    const { action } = req.body;   // Should be either "approved" or "rejected"

    if (!["approved", "rejected"].includes(action)) {
      return res.status(400).json({ message: "Invalid action. Use 'approved' or 'rejected'." });
    }

    const merchant = await User.findById(userId);

    if (!merchant || merchant.userType !== "merchant") {
      return res.status(404).json({ message: "Merchant not found." });
    }

    // Update status
    merchant.merchantApplication.status = action;
    await merchant.save();

    // Compose and send SMS
    const message = `Hello ${merchant.name}, your merchant application has been ${action.toUpperCase()}.`;
    if (merchant.phone) {
      await sendSms(merchant.phone, message);
    }

    res.status(200).json({ message: `Merchant has been ${action} and notified.` });
  } catch (err) {
    console.error("Error updating merchant status:", err);
    res.status(500).json({ message: "Server error" });
  }
};



// Get permissions for a specific restaurant
exports.getPermissions = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ error: 'Invalid restaurant ID' });
    }

    const permissionDoc = await ChangeRequest.findOne({ restaurantId });
    if (!permissionDoc) {
      return res.status(404).json({ message: 'Permissions not found for this restaurant' });
    }

    res.json(permissionDoc);
  } catch (err) {
    console.error('Error fetching permissions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};



// Update permissions for a specific restaurant
exports.updatePermissions = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ error: 'Invalid restaurant ID' });
    }

    // Validate restaurant existence before updating permissions
    const restaurantExists = await Restaurant.exists({ _id: restaurantId });
    if (!restaurantExists) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Only these keys can be updated
    const allowedKeys = ['canManageMenu', 'canAcceptOrder', 'canRejectOrder', 'canManageOffers', 'canViewReports'];

    // Filter only allowed keys from req.body.permissions
    const updatedPermissions = {};
    for (const key of allowedKeys) {
      if (req.body.permissions && typeof req.body.permissions[key] === 'boolean') {
        updatedPermissions[key] = req.body.permissions[key];
      }
    }

    if (Object.keys(updatedPermissions).length === 0) {
      return res.status(400).json({ error: 'No valid permissions provided to update' });
    }

    // Upsert permissions doc (create if doesn't exist)
    const permissionDoc = await Permission.findOneAndUpdate(
      { restaurantId },
      { permissions: updatedPermissions },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({
      message: 'Permissions updated successfully',
      permissions: permissionDoc.permissions
    });
  } catch (err) {
    console.error('Error updating permissions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// Get all pending change requests (for admin dashboard)
exports.getPendingChangeRequests = async (req, res) => {
  try {
    const pendingRequests = await ChangeRequest.find({ status: 'PENDING', type: 'MENU_CHANGE' })
      .populate('restaurantId', 'name')
      .populate('requestedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ requests: pendingRequests });
  } catch (err) {
    console.error('Error fetching pending requests:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

//  Approve or Reject a change request
exports.reviewChangeRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body; // should be 'APPROVE' or 'REJECT'

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be APPROVE or REJECT' });
    }

    const changeRequest = await ChangeRequest.findById(requestId);
    if (!changeRequest) return res.status(404).json({ error: 'Change request not found' });
    if (changeRequest.status !== 'PENDING') return res.status(400).json({ error: 'Request already reviewed' });

    // Set review metadata
    changeRequest.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    changeRequest.reviewedBy = req.user._id;
    changeRequest.reviewedAt = new Date();

    if (action === 'APPROVE') {
      const { data } = changeRequest;
      const restaurantId = changeRequest.restaurantId;

      switch (data.action) {
        case 'CREATE_PRODUCT':
          {
            // Create product from payload
            const { payload } = data;
            // Optional: Validate category belongs to restaurant again
            const category = await Category.findOne({ _id: payload.categoryId, restaurantId });
            if (!category) {
              return res.status(400).json({ error: 'Invalid category for this restaurant' });
            }
            const newProduct = new Product({
              restaurantId,
              ...payload,
              name: payload.name.trim()
            });
            await newProduct.save();
          }
          break;

        case 'UPDATE_PRODUCT':
          {
            const { productId, payload } = data;
            if (!mongoose.Types.ObjectId.isValid(productId)) {
              return res.status(400).json({ error: 'Invalid product ID in request data' });
            }
            const product = await Product.findById(productId);
            if (!product) {
              return res.status(404).json({ error: 'Product to update not found' });
            }
            Object.assign(product, payload);
            await product.save();
          }
          break;

        case 'DELETE_PRODUCT':
          {
            const { productId } = data;
            if (!mongoose.Types.ObjectId.isValid(productId)) {
              return res.status(400).json({ error: 'Invalid product ID in request data' });
            }
            const product = await Product.findById(productId);
            if (!product) {
              return res.status(404).json({ error: 'Product to delete not found' });
            }
            await product.remove();
          }
          break;

        case 'TOGGLE_PRODUCT_ACTIVE':
          {
            const { productId, currentStatus } = data;
            if (!mongoose.Types.ObjectId.isValid(productId)) {
              return res.status(400).json({ error: 'Invalid product ID in request data' });
            }
            const product = await Product.findById(productId);
            if (!product) {
              return res.status(404).json({ error: 'Product not found for toggle' });
            }
            product.active = !currentStatus;
            await product.save();
          }
          break;

        default:
          return res.status(400).json({ error: 'Unknown action type in change request' });
      }
    }

    await changeRequest.save();

    res.json({
      message: `Request has been ${changeRequest.status.toLowerCase()}`,
      request: changeRequest
    });
  } catch (err) {
    console.error('Error reviewing change request:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};


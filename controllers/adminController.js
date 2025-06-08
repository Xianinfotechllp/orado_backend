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
const permissionsList = require('../utils/adminPermissions')
const logAccess = require('../utils/logAccess')
const AccessLog = require('../models/accessLogModel')
const { isValidObjectId } = require("mongoose");
const {uploadOnCloudinary} = require("../utils/cloudinary")
const fs = require('fs');
const path = require('path');
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



// Creating admin / updating and deleting


// Create Admin
exports.createAdmin = async (req, res) => {
  try {
    const { name, email, phone, password, permissions } = req.body;

    // Permissions  check
    if (!Array.isArray(permissions) || !permissions.every(p => permissionsList.includes(p))) {
      return res.status(400).json({ message: "Invalid permissions provided." });
    }

    const hashedPassword = await require("bcryptjs").hash(password, 10);

    const admin = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      userType: "admin",
      adminPermissions: permissions,
    });

    await admin.save();

    // For logging this
    await logAccess({
      userId: req.user._id, 
      action: "admin.create",
      description: `Created a new admin ${admin.name}`,
      req,
    });
    res.status(201).json({ message: "Admin created successfully", admin });
  } catch (error) {
    console.error("Error creating admin:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete Admin
exports.deleteAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;

    const admin = await User.findById(adminId);

    if (!admin || admin.userType !== "admin") {
      return res.status(404).json({ message: "Admin not found" });
    }

    await User.findByIdAndDelete(adminId);

    // For logging this
    await logAccess({
      userId: req.user._id,
      action: "admin.delete",
      description: `Deleted admin with name ${admin.name}`,
      req,
    });
    res.status(200).json({ message: "Admin deleted successfully" });
  } catch (error) {
    console.error("Error deleting admin:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update Admin Permissions
exports.updateAdminPermissions = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions) || !permissions.every(p => permissionsList.includes(p))) {
      return res.status(400).json({ message: "Invalid permissions provided." });
    }

    const admin = await User.findById(adminId);

    if (!admin || admin.userType !== "admin") {
      return res.status(404).json({ message: "Admin not found" });
    }

    admin.adminPermissions = permissions;
    await admin.save();

    // For logging this
    await logAccess({
      userId: req.user._id,
      action: "admin.permissions",
      description: `Updated these admin permissions ${admin.adminPermissions} for ${admin.name}`,
      req,
    });
    res.status(200).json({ message: "Permissions updated successfully", permissions });
  } catch (error) {
    console.error("Error updating permissions:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// get all admins

exports.getAllAdmins = async (req, res) => {
  try {
    const admins = await User.find({ userType: "admin" }).select("-password");

    res.status(200).json({
      message: "Admins fetched successfully",
      count: admins.length,
      admins,
    });
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({ message: "Internal server error" });
  }
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

    // For logging this
    await logAccess({
      userId: req.user._id,
      action: "agent.approval",
      description: `${action} agent registration request for agent ${user.name} with id  ${userId}`,
      req,
    });

    // Send SMS
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



// get pending restaurant requests


exports.getPendingRestaurantApprovals = async (req, res) => {
  try {
    // Fetch restaurants where kycStatus is 'pending'
    const pendingRestaurants = await Restaurant.find({ kycStatus: "pending" })
    res.status(200).json({
      message: "Pending restaurant approval requests fetched successfully.",
      total: pendingRestaurants.length,
      restaurants: pendingRestaurants,
    });
  } catch (error) {
    console.error("Error fetching pending restaurants:", error);
    res.status(500).json({
      message: "Server error while fetching pending approval requests.",
      error: error.message,
    });
  }
};

// approve or reject merchant application
exports.updateRestaurantApprovalStatus = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { action, reason } = req.body;

    // Validate action
    if (!["approved", "rejected"].includes(action)) {
      return res.status(400).json({ message: "Invalid action. Must be 'approved' or 'rejected'." });
    }

    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found." });
    }

    if (restaurant.kycStatus !== "pending") {
      return res.status(400).json({ message: `Restaurant is already ${restaurant.kycStatus}.` });
    }
    if (restaurant.approvalStatus !== "pending") {
      return res.status(400).json({ message: `Restaurant is already ${restaurant.approvalStatus}.` });
    }

    // Update status
    restaurant.kycStatus = action;
    restaurant.approvalStatus = action;
    if (action === "rejected") {
      restaurant.kycRejectionReason = reason || "Not specified";
      restaurant.approvalRejectionReason = reason || "Not specified"
    } else {
      restaurant.kycRejectionReason = undefined; // clear any previous rejection reason
    }

    await restaurant.save();

    // // For logging this
    // await logAccess({
    //   userId: req.user._id,
    //   action: "restaurant.registration",
    //   description: `${action} restaurant registration for restaurant named ${restaurant.name} with id ${restaurantId}`,
    //   req,
    // });
    const message = `Hello ${restaurant.name}, your restaurant application has been ${restaurant.approvalStatus.toUpperCase()}.`;
   

    res.status(200).json({
      message: `Restaurant KYC ${action} successfully.`,
      restaurant,
    });
  } catch (error) {
    console.error("Error updating KYC status:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
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



exports.toggleRestaurantPermission = async (req, res) => {
  try {
    const { restaurantId, permissionKey, value } = req.body;

    // Validate input
    if (!restaurantId || !permissionKey || typeof value !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'restaurantId, permissionKey and boolean value are required.',
      });
    }

    // Check if restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found.',
      });
    }

    // Find or create permission document for the restaurant
    let permissionDoc = await Permission.findOne({ restaurantId });
    if (!permissionDoc) {
      permissionDoc = await Permission.create({
        restaurantId,
        permissions: {} // will auto-default to schema defaults
      });
    }

    // Check if permissionKey is valid
    if (!Object.keys(permissionDoc.permissions.toObject()).includes(permissionKey)) {
      return res.status(400).json({
        success: false,
        message: `Invalid permission key: ${permissionKey}`,
      });
    }

    // Update the specific permission
    permissionDoc.permissions[permissionKey] = value;
    await permissionDoc.save();

    res.status(200).json({
      success: true,
      message: `Permission ${permissionKey} updated successfully.`,
      data: permissionDoc.permissions
    });

  } catch (error) {
    console.error('Toggle permission error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};









// Update permissions for a specific restaurant
exports.updatePermissions = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ error: 'Invalid restaurant ID' });
    }
    const restaurant = await Restaurant.findById(restaurantId)
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

    // For logging this
    await logAccess({
      userId: req.user._id,
      action: "restaurant.permissions",
      description: `Updated these restaurant permissions ${permissionDoc.permissions} for this restaurant ${restaurant.name}`,
      req,
    });
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

    // For logging this
    await logAccess({
      userId: req.user._id,
      action: "products.change",
      description: `${changeRequest.status} restaurant request for ${data.action} for restaurant with id ${changeRequest.restaurantId}`,
      req,
    });

    res.json({
      message: `Request has been ${changeRequest.status.toLowerCase()}`,
      request: changeRequest
    });
  } catch (err) {
    console.error('Error reviewing change request:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// get all agent permission requests
exports.getAllAgentPermissionRequests = async (req, res) => {
  const agents = await Agent.find({ "permissionRequests.status": "Pending" })
    .select("fullName permissionRequests")
    .lean();

  const pendingRequests = [];

  agents.forEach((agent) => {
    agent.permissionRequests.forEach((req) => {
      if (req.status === "Pending") {
        pendingRequests.push({
          agentId: agent._id,
          fullName: agent.fullName,
          permission: req.permissionType,  // use permissionType here
          requestedAt: req.requestedAt,
          status: req.status,               // add any other info you want here
          responseDate: req.responseDate,
          adminComment: req.adminComment
        });
      }
    });
  });

  res.status(200).json({ requests: pendingRequests });
};


exports.handleAgentPermissionRequest = async (req, res) => {
  const { agentId, permission, decision, reason } = req.body;
  const adminId = req.user.id; 

  const agent = await Agent.findById(agentId);
  if (!agent) return res.status(404).json({ error: "Agent not found." });

  const request = agent.permissionRequests.find(
    (r) => r.permissionType === permission && r.status === "Pending"
  );

  if (!request) {
    return res.status(400).json({ error: "No pending request for this permission." });
  }

  request.status = decision;
  request.responseDate = new Date(); // Your schema calls it responseDate, not reviewedAt
  request.adminComment = reason || "";
  request.adminId = adminId; // Optional: You can add adminId to the schema if you want to track it

  // Actually update the permission
  if (decision === "Approved") {
    agent.permissions[permission] = true;
  }

  // For logging this
    await logAccess({
      userId: req.user._id,
      action: "agent.permissions",
      description: `${request.status} agent request for ${permission} for agent with name ${agent.fullName}`,
      req,
    });
  await agent.save();

  res.status(200).json({ message: `Request ${decision}` });
};


// Get all access logs (superAdmin-only)
exports.getAllAccessLogs = async (req, res) => {
  try {
    const logs = await AccessLog.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("Error fetching all access logs:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get access logs for the logged-in admin
exports.getMyLogs = async (req, res) => {
  try {
    const userId = req.user._id; 

    const logs = await AccessLog.find({ userId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("Error fetching user access logs:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



// ✅ Get restaurant details by ID for Admin
exports.getRestaurantById = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // Validate restaurantId format
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid restaurant ID",
      });
    }

    const restaurant = await Restaurant.findById(restaurantId)

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Restaurant details fetched successfully",
      data: restaurant,
    });

  } catch (err) {
    console.error(`❌ Error fetching restaurant (ID: ${req.params.restaurantId}):`, err);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching restaurant details",
      error: err.message,
    });
  }
};








exports.updatePermissionsRestuarants = async (req, res) => {
  try {
       
    const { restaurantId, permissions } = req.body;
 

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ message: 'Invalid restaurant ID' });
    }

    const validPermissions = [
      'canManageMenu',
      'canAcceptOrder',
      'canRejectOrder',
      'canManageOffers',
      'canViewReports'
    ];

    const invalidKeys = Object.keys(permissions).filter(
      (key) => !validPermissions.includes(key)
    );

    if (invalidKeys.length > 0) {
      return res.status(400).json({ message: `Invalid permission keys: ${invalidKeys.join(', ')}` });
    }

    let permissionDoc = await Permission.findOne({ restaurantId });
 

    if (!permissionDoc) {
      permissionDoc = await Permission.create({
        restaurantId,
        permissions
      });
      // console.log("Created new permission doc: ", permissionDoc); 
    } else {
      Object.keys(permissions).forEach((key) => {
        permissionDoc.permissions[key] = permissions[key];
      });
      await permissionDoc.save();
      // console.log("Updated permission doc: ", permissionDoc);
    }

    res.status(200).json({
      message: 'Permissions updated successfully',
      permissions: permissionDoc.permissions
    });

  } catch (error) {
    console.error("Error while updating permissions: ", error);
    res.status(500).json({ message: 'Server Error', error });
  }
};




exports.getRestaurantsWithPermissions = async (req, res) => {
  try {
      console.log("correct api call")
    // Fetch all restaurants
    const restaurants = await Restaurant.find();

    // Fetch permissions for each restaurant and attach
    const restaurantList = await Promise.all(
      restaurants.map(async (restaurant) => {
        const permissionDoc = await Permission.findOne({ restaurantId: restaurant._id });

        return {
          _id: restaurant._id,
          name: restaurant.name,
          email: restaurant.email, // if exists
          permissions: permissionDoc ? permissionDoc.permissions : {
            canManageMenu: false,
            canAcceptOrder: false,
            canRejectOrder: false,
            canManageOffers: false,
            canViewReports: true
          }
        };
      })
    );
  
    
    

    res.status(200).json({
      message: 'Restaurant list with permissions fetched successfully',
      data: restaurantList
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error', error });
  }
};







exports.createCategory = async (req, res) => {
  try {
    const { name, restaurantId, active = true, autoOnOff = false, description = '', images = [] } = req.body;

    if (!name?.trim() || !restaurantId) {
      return res.status(400).json({ message: 'Category name and restaurantId are required' });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    // ✅ Check if category with same name exists for the restaurant
    const existingCategory = await Category.findOne({ name: name.trim(), restaurantId });
    if (existingCategory) {
      return res.status(400).json({ message: 'Category with this name already exists for this restaurant' });
    }

    const category = new Category({
      name: name.trim(),
      restaurantId,
      active,
      autoOnOff,
      description,
      images
    });

    await category.save();

    res.status(201).json({
      message: 'Category created successfully',
      category
    });

  } catch (error) {
    console.error('Error creating category:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};






exports.updateRestaurant = async (req, res) => {
  try {
    if (!req.body) return res.status(400).json({ message: 'Request body is missing.' });

    const { restaurantId } = req.params;
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found.' });

    const {
      name,
      address,
      phone,
      email,
      openingHours,
      foodType,
      merchantSearchName,
      minOrderAmount,
      paymentMethods,
      isActive,
      status
    } = req.body;

    // Update basic fields if they exist
    if (name) restaurant.name = name;
    if (phone) restaurant.phone = phone;
    if (email) restaurant.email = email;
    if (foodType) restaurant.foodType = foodType;
    if (merchantSearchName) restaurant.merchantSearchName = merchantSearchName;
    if (minOrderAmount) restaurant.minOrderAmount = minOrderAmount;
    if (paymentMethods) restaurant.paymentMethods = paymentMethods;
    if (openingHours) restaurant.openingHours = openingHours;
    if (isActive !== undefined) restaurant.isActive = isActive;
    if (status) restaurant.status = status;

    // 🧭 Address and Location
    if (address) {
      restaurant.address.street = address?.street || restaurant.address.street;
      restaurant.address.city = address?.city || restaurant.address.city;
      restaurant.address.state = address?.state || restaurant.address.state;
      restaurant.address.zip = address?.pincode || restaurant.address.zip;

      if (address.coordinates && address.coordinates.length === 2) {
        restaurant.location = {
          type: "Point",
          coordinates: [address.coordinates[1], address.coordinates[0]],
        };
      }
    }

    if (req.files && req.files.length > 0) {
      const uploads = await Promise.all(
        req.files.map(file => uploadOnCloudinary(file.path))
      );
      const newImageUrls = uploads
        .filter(result => result && result.secure_url)
        .map(result => result.secure_url);

      // Replace images
      restaurant.images = newImageUrls;
    }

    await restaurant.save();
    res.status(200).json({
      message: 'Restaurant updated successfully.',
      restaurant
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error.', error });
  }
};




exports.getRestaurantCategory = async (req, res) => {
  try {
    const { restaurantId } = req.params; 
     console.log(restaurantId)
    // Validate the restaurantId
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid restaurant ID"
      });
    }

    // Find all active categories for the given restaurant
    const categories = await Category.find({
      restaurantId: restaurantId
     
    }) // Excluding the version key

  

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });

  } catch (error) {
    console.error("Error fetching restaurant categories:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};




exports.createCategory = async (req, res) => {
  try {
   const {restaurantId} = req.params
        
    const { name, description = "", autoOnOff = false } = req.body;
    // 1. Validate Inputs
    if (!restaurantId || !name?.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: "Restaurant ID and name are required." 
      });
    }

    if (!isValidObjectId(restaurantId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid Restaurant ID." 
      });
    }

    // 2. Check for Duplicate Category
    const existingCategory = await Category.findOne({
      restaurantId,
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    });

    if (existingCategory) {
      // Clean up uploaded files if duplicate found
      if (req.files?.length) {
        await Promise.all(req.files.map(file => 
          fs.promises.unlink(file.path).catch(console.error)
        ));
      }
      return res.status(409).json({ 
        success: false, 
        message: "Category name already exists." 
      });
    }

    // 3. Process and Upload Images to Cloudinary
    const imageUrls = [];
    if (req.files?.length) {
      // Upload each file to Cloudinary
      const uploadResults = await Promise.all(
        req.files.map(file => 
          uploadOnCloudinary(file.path, 'restaurant_categories')
        )
      );
      
      // Extract secure URLs from successful uploads
      for (const result of uploadResults) {
        if (result?.secure_url) {
          imageUrls.push(result.secure_url);
        }
      }
    }

    // 4. Create Category with Cloudinary URLs
    const newCategory = await Category.create({
      restaurantId,
      name: name.trim(),
      description: description.trim(),
      images: imageUrls, // Store array of Cloudinary image objects
      autoOnOff,
    });

    // 5. Send Response
    const { __v, ...categoryData } = newCategory.toObject();

    return res.status(201).json({
      success: true,
      message: "Category created successfully with images!",
      data: categoryData,
    });

  } catch (error) {
    console.error("🚨 Create Category Error:", error);

    // Clean up any uploaded files on error
    if (req.files?.length) {
      await Promise.all(req.files.map(file => 
        fs.promises.unlink(file.path).catch(console.error)
      ));
    }

    // Handle specific errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: "File size too large. Maximum 5MB per image.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};







exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      categoryId,
      foodType,
      addOns = [],
      specialOffer = {},
      attributes = [],
      unit = "piece",
      stock = 0,
      reorderLevel = 0,
      revenueShare = { type: "percentage", value: 10 }
    } = req.body;

    const { restaurantId } = req.params;

    // Validate required fields
    if (!name || !price || !categoryId || !restaurantId || !foodType) {
      return res.status(400).json({
        success: false,
        message: "name, price, categoryId, restaurantId and foodType are required fields"
      });
    }

    // Validate ObjectIds
    if (!mongoose.isValidObjectId(restaurantId)) {
      return res.status(400).json({ success: false, message: "Invalid restaurant ID format" });
    }

    if (!mongoose.isValidObjectId(categoryId)) {
      return res.status(400).json({ success: false, message: "Invalid category ID format" });
    }

    // Validate food type
    if (!["veg", "non-veg"].includes(foodType)) {
      return res.status(400).json({
        success: false,
        message: 'Food type must be either "veg" or "non-veg"'
      });
    }

    // Upload images to Cloudinary
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      const uploadResults = await Promise.all(
        req.files.map(file => uploadOnCloudinary(file.path, "restaurant_products"))
      );

      imageUrls = uploadResults
        .filter(result => result?.secure_url)
        .map(result => result.secure_url);
    }

    // Create Product
    const newProduct = await Product.create({
      name: name.trim(),
      description: description?.trim(),
      price: parseFloat(price),
      categoryId,
      restaurantId,
      images: imageUrls,
      foodType,
      addOns,
      attributes,
      unit,
      stock: parseInt(stock),
      reorderLevel: parseInt(reorderLevel),
      revenueShare
    });

    const response = newProduct.toObject();
    delete response.__v;

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: response
    });

  } catch (error) {
    console.error("Error creating product:", error);

    if (req.files?.length) {
      await Promise.all(req.files.map(file =>
        fs.promises.unlink(file.path).catch(console.error)
      ));
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};



exports.getCategoryProducts = async (req, res) => {
  try {
    const { restaurantId, categoryId } = req.params;

    // Validate IDs
    if (!isValidObjectId(restaurantId) || !isValidObjectId(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid restaurant or category ID'
      });
    }

    // Find all active products in this category and restaurant
    const products = await Product.find({
      restaurantId,
      categoryId
    })
    .sort({ name: 1 }) // Sort alphabetically

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });

  } catch (error) {
    console.error('Error fetching category products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};




exports.updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    // Find product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const {
      name, description, price, categoryId, foodType, addOns, attributes, unit, stock, reorderLevel, revenueShare, replaceImageIndex
    } = req.body;

    // Update fields if provided
    if (name) product.name = name.trim();
    if (description) product.description = description.trim();
    if (price) product.price = parseFloat(price);
    if (categoryId) product.categoryId = categoryId;
    if (foodType) product.foodType = foodType;
    if (addOns) product.addOns = addOns;
    if (attributes) product.attributes = attributes;
    if (unit) product.unit = unit;
    if (stock) product.stock = parseInt(stock);
    if (reorderLevel) product.reorderLevel = parseInt(reorderLevel);
    if (revenueShare) product.revenueShare = revenueShare;

    // Image handling
    if (req.files && req.files.length > 0) {
      if (replaceImageIndex !== undefined && !isNaN(replaceImageIndex)) {
        // Replace single image at given index
        const uploadResult = await uploadOnCloudinary(req.files[0].path, 'restaurant_products');
        if (uploadResult?.secure_url) {
          const idx = parseInt(replaceImageIndex);
          if (idx >= 0 && idx < product.images.length) {
            product.images[idx] = uploadResult.secure_url;
          } else {
            product.images.push(uploadResult.secure_url);
          }
        }
      } else {
        // No replaceImageIndex — replace all images
        product.images = []; // Clear old images

        for (const file of req.files) {
          const uploadResult = await uploadOnCloudinary(file.path, 'restaurant_products');
          if (uploadResult?.secure_url) {
            product.images.push(uploadResult.secure_url);
          }
        }
      }
    }

    await product.save();

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });

  } catch (error) {
    console.error('Error updating product:', error);

    // Cleanup uploaded files on error
    if (req.files?.length) {
      await Promise.all(req.files.map(file =>
        fs.promises.unlink(file.path).catch(console.error)
      ));
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};












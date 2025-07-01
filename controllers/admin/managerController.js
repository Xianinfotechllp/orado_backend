const Manager = require("../../models/managerModel");
const Role = require("../../models/roleModel");
const Brand = require("../../models/brandModel")
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose")
// Email format regex
const emailRegex = /^\S+@\S+\.\S+$/;
// Phone number basic regex (10-14 digits)
const phoneRegex = /^[0-9]{10,14}$/;

exports.createManager = async (req, res) => {
  try {
    const { name, email, phone, password, role, assignedRestaurants, assignedBrands } = req.body;

    // Basic required field check
    if (!name || !email || !phone || !password || !role) {
      return res.status(400).json({ message: "Name, email, phone, password and role are required." });
    }

    // Email format validation
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    // Phone format validation
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: "Invalid phone number format." });
    }

    // Check duplicate email
    const existingManager = await Manager.findOne({ email: email.trim().toLowerCase() });
    if (existingManager) {
      return res.status(400).json({ message: "Email already exists." });
    }

    // Check if Role exists
    const roleExists = await Role.findById(role);
    if (!roleExists) {
      return res.status(400).json({ message: "Invalid role ID." });
    }

    // Hash password securely
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create Manager
    const newManager = await Manager.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password: hashedPassword,
      role,
      assignedRestaurants,
      assignedBrands
    });

    // Respond without password
    res.status(201).json({
      message: "Manager created successfully.",
      manager: {
        _id: newManager._id,
        name: newManager.name,
        email: newManager.email,
        phone: newManager.phone,
        role: newManager.role,
        assignedRestaurants: newManager.assignedRestaurants,
        assignedBrands: newManager.assignedBrands,
        createdAt: newManager.createdAt,
      },
    });

  } catch (error) {
    console.error("Error creating manager:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};




exports.getAllManagers = async (req, res) => {
  try {
    let { page = 1, limit = 10 } = req.query;

    // Parse to integers
    page = parseInt(page);
    limit = parseInt(limit);

    // Validate pagination values
    if (isNaN(page) || page < 1) {
      return res.status(400).json({ message: "Invalid page number. Must be a positive integer." });
    }
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ message: "Invalid limit. Must be between 1 and 100." });
    }

    const skip = (page - 1) * limit;

    const totalManagers = await Manager.countDocuments();

    const managers = await Manager.find()
      .populate("role", "roleName")
      .populate("assignedRestaurants", "name")
      .populate("assignedBrands", "brandName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      message: "Managers fetched successfully.",
      total: totalManagers,
      page,
      limit,
      totalPages: Math.ceil(totalManagers / limit),
      managers,
    });

  } catch (error) {
    console.error("Error fetching managers:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};




exports.getManagerById = async (req, res) => {
  try {
    const { managerId } = req.params;

    if (!managerId) {
      return res.status(400).json({ message: "Manager ID is required." });
    }

    const manager = await Manager.findById(managerId)
      .populate("role", "roleName")
      .populate("assignedRestaurants", "name")
      .populate("assignedBrands", "brandName");

    if (!manager) {
      return res.status(404).json({ message: "Manager not found." });
    }

    res.status(200).json({
      message: "Manager fetched successfully.",
      manager,
    });

  } catch (error) {
    console.error("Error fetching manager by ID:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


exports.updateManager = async (req, res) => {
  try {
    const { managerId } = req.params;
    const { name, email, phone, password, role, assignedRestaurants, assignedBrands } = req.body;

    // Validate managerId format
    if (!mongoose.Types.ObjectId.isValid(managerId)) {
      return res.status(400).json({ message: "Invalid Manager ID format." });
    }

    // Find existing manager
    const manager = await Manager.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found." });
    }

    // If email is being updated, validate and check for uniqueness
    if (email) {
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format." });
      }
      const existingEmail = await Manager.findOne({ email: email.trim().toLowerCase(), _id: { $ne: managerId } });
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists." });
      }
      manager.email = email.trim().toLowerCase();
    }

    // Validate phone if provided
    if (phone && !phoneRegex.test(phone)) {
      return res.status(400).json({ message: "Invalid phone number format." });
    }

    // Check if Role exists if role is being updated
    if (role) {
      const roleExists = await Role.findById(role);
      if (!roleExists) {
        return res.status(400).json({ message: "Invalid role ID." });
      }
      manager.role = role;
    }

    // Update other fields
    if (name) manager.name = name.trim();
    if (phone) manager.phone = phone.trim();
    if (Array.isArray(assignedRestaurants)) manager.assignedRestaurants = assignedRestaurants;
    if (Array.isArray(assignedBrands)) manager.assignedBrands = assignedBrands;

    // If password is being updated
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      manager.password = hashedPassword;
    }

    await manager.save();

    res.status(200).json({
      message: "Manager updated successfully.",
      manager: {
        _id: manager._id,
        name: manager.name,
        email: manager.email,
        phone: manager.phone,
        role: manager.role,
        assignedRestaurants: manager.assignedRestaurants,
        assignedBrands: manager.assignedBrands,
        createdAt: manager.createdAt,
        updatedAt: manager.updatedAt,
      },
    });

  } catch (error) {
    console.error(`Error updating manager with ID ${req.params.managerId}:`, error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.deleteManager = async (req, res) => {
  try {
    const { managerId } = req.params;

    // Validate managerId format
    if (!mongoose.Types.ObjectId.isValid(managerId)) {
      return res.status(400).json({ message: "Invalid Manager ID format." });
    }

    // Check if manager exists
    const manager = await Manager.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found." });
    }

    // Delete manager
    await manager.deleteOne();

    res.status(200).json({
      message: "Manager deleted successfully.",
    });

  } catch (error) {
    console.error(`Error deleting manager with ID ${req.params.managerId}:`, error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
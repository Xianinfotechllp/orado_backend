// const Manager = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Manager = require("../models/managerModel")

exports.loginManager = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    const errors = {};
    if (!email) errors.email = "Email is required";
    if (!password) errors.password = "Password is required";
    
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ 
        message: "Validation failed",
        errors 
      });
    }

    // Check if email is valid format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        message: "Invalid email format",
        errors: { email: "Please enter a valid email address" }
      });
    }

    const manager = await Manager.findOne({ email: email.toLowerCase() })
      .populate("role")
      .select("+password"); // Include password field which is normally excluded

    if (!manager) {
      return res.status(401).json({ 
        message: "Login failed",
        errors: { 
          email: "Invalid email or password",
          password: "Invalid email or password" 
        }
      });
    }

    const isMatch = await bcrypt.compare(password, manager.password);
    if (!isMatch) {
      return res.status(401).json({ 
        message: "Login failed",
        errors: { 
          email: "Invalid email or password",
          password: "Invalid email or password" 
        }
      });
    }

    // Generate token
    const token = jwt.sign(
      { managerId: manager._id, role: manager.role.roleName },
      process.env.JWT_SECRET,
      { expiresIn: "2d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      manager: {
        _id: manager._id,
        name: manager.name,
        email: manager.email,
        phone: manager.phone,
        role: manager.role,
        assignedRestaurants: manager.assignedRestaurants,
        assignedBrands: manager.assignedBrands,
      },
    });

  } catch (error) {
    console.error("Manager login error:", error);
    res.status(500).json({ 
      message: "An unexpected error occurred",
      error: error.message 
    });
  }
};
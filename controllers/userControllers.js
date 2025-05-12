const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const otpGenerator = require("../utils/otpGenerator");

exports.registerUser = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Email or phone number already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = otpGenerator(6);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    const newUser = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      verification: {
        otp,
        otpExpiry,
      },
    });

    await newUser.save();

    res.status(201).json({
      message: "User registered successfully",
      userId: newUser._id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.verification.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (user.verification.otpExpiry < new Date()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    user.verification.emailVerified = true;
    user.verification.phoneVerified = true;
    user.verification.otp = null;
    user.verification.otpExpiry = null;
    await user.save();

    res.json({ message: "OTP verified successfully", userId: user._id });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const userExist = await User.findOne({ email });
    if (!userExist) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, userExist.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: userExist._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Logged in successfully",
      token,
      userId: userExist._id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


exports.addAddress = async (req, res) => {
    try {
      const { street, city, state, zip, longitude, latitude, userId } = req.body;
  
      if (!street || !city || !state || !zip || !longitude || !latitude || !userId) {
        return res.status(400).json({ message: "All fields are required" });
      }
  
      const userExist = await User.findById(userId);
      if (!userExist) {
        return res.status(404).json({ message: "User not found" });
      }
  
      userExist.address = {
        street,
        city,
        state,
        zip,
        location: {
          type: "Point",  // ✅ Important for GeoJSON!
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        }
      };
       
      await userExist.save();
  
      res.json({ message: "Address updated successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  };

  exports.deleteAddressById = async (req, res) => {
    try {
      const { userId, addressId } = req.params;
  
      // Find the user by userId
      const userExist = await User.findById(userId);
      if (!userExist) {
        return res.status(404).json({ message: "User not found" });
      }
  
      // Check if the user has the specified addressId
      const addressExists = userExist.address.id(addressId); // If it's a subdocument (array of addresses)
      if (!addressExists) {
        return res.status(404).json({ message: "Address not found" });
      }
  
      // Remove the address
      userExist.address.id(addressId).remove();
  
      // Save the updated user
      await userExist.save();
  
      res.json({ message: "Address deleted successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  };
  

  exports.updateAddressById = async (req, res) => {
    try {
      const { userId, addressId } = req.params; // Extract userId and addressId from request params
      const { street, city, state, zip, longitude, latitude } = req.body; // Extract address fields from request body
  
      // Validate the required fields
      if (!street || !city || !state || !zip || !longitude || !latitude) {
        return res.status(400).json({ message: "All address fields are required" });
      }
  
      // Find the user by userId
      const userExist = await User.findById(userId);
      if (!userExist) {
        return res.status(404).json({ message: "User not found" });
      }
  
      // Find the address by addressId within the user's address subdocument
      const address = userExist.address.id(addressId);
      if (!address) {
        return res.status(404).json({ message: "Address not found" });
      }
  
      // Update the address fields
      address.street = street;
      address.city = city;
      address.state = state;
      address.zip = zip;
      address.location = {
        type: "Point",  // Required for GeoJSON
        coordinates: [parseFloat(longitude), parseFloat(latitude)]  // Ensure coordinates are floats
      };
  
      // Save the updated user document
      await userExist.save();
  
      res.json({ message: "Address updated successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  };
  
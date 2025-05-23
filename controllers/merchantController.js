const User = require("../models/userModel");
const Session = require("../models/session");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require("mongoose");
const { uploadOnCloudinary } = require('../utils/cloudinary');


exports.registerMerchant = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      aadhaarNumber,
      fssaiNumber,
      gstNumber
    } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "All basic fields are required." });
    }

    const aadhaarCardFile = req.files?.aadhaarCard?.[0];
    const fssaiLicenseFile = req.files?.fssaiLicense?.[0];
    const gstCertificateFile = req.files?.gstCertificate?.[0];

    if (!aadhaarCardFile || !fssaiLicenseFile || !gstCertificateFile) {
      return res.status(400).json({ message: "All documents are required." });
    }

    // Check for existing user
    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      return res.status(409).json({ message: "Email or phone already in use." });
    }

    // Upload files to Cloudinary
    let aadhaarCardUrl = "", fssaiLicenseUrl = "", gstCertificateUrl = "";

    if (aadhaarCardFile) {
      const result = await uploadOnCloudinary(aadhaarCardFile.path);
      aadhaarCardUrl = result?.secure_url;
    }

    if (fssaiLicenseFile) {
      const result = await uploadOnCloudinary(fssaiLicenseFile.path);
      fssaiLicenseUrl = result?.secure_url;
    }

    if (gstCertificateFile) {
      const result = await uploadOnCloudinary(gstCertificateFile.path);
      gstCertificateUrl = result?.secure_url;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create merchant user
    const newMerchant = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      userType: "merchant",
      merchantApplication: {
        aadhaarCard: aadhaarCardUrl,
        aadhaarNumber,
        fssaiLicense: fssaiLicenseUrl,
        fssaiNumber,
        gstCertificate: gstCertificateUrl,
        gstNumber,
        submittedAt: new Date(),
        status: "pending"
      }
    });

    await newMerchant.save();

    res.status(201).json({ message: "Merchant registration submitted! Awaiting approval." });
  } catch (err) {
    console.error("Merchant registration error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
};


exports.loginMerchant = async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier = email or phone

    if (!identifier || !password) {
      return res.status(400).json({ message: "Email/Phone and password are required." });
    }

    const userExist = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }],
      userType: "merchant"
    });

    if (!userExist) {
      return res.status(404).json({ message: "Merchant not found." });
    }

    // Check if merchant is approved
    if (
      !userExist.merchantApplication ||
      userExist.merchantApplication.status !== "approved"
    ) {
      return res.status(403).json({ message: "Merchant not approved yet." });
    }

    const isPasswordValid = await bcrypt.compare(password, userExist.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password." });
    }

    const token = jwt.sign(
      { userId: userExist._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Limit to 3 active sessions
    const MAX_SESSIONS = 3;
    const existingSessions = await Session.find({ userId: userExist._id }).sort({ createdAt: 1 });

    if (existingSessions.length >= MAX_SESSIONS) {
      const oldestSession = existingSessions[0];
      await Session.findByIdAndDelete(oldestSession._id); // Kick the oldest session out
    }

    // Get device + IP info 
    const userAgent = req.headers["user-agent"] || "Unknown Device";
    const ip = req.ip || req.connection.remoteAddress || "Unknown IP";

    // Save new session in DB
    await Session.create({
      userId: userExist._id,
      token,
      userAgent,
      ip,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: userExist._id,
        name: userExist.name,
        email: userExist.email,
        phone: userExist.phone,
        userType: userExist.userType
      }
    });
  } catch (err) {
    console.error("Merchant login error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Logout user by deleting session

exports.logoutMerchant = async (req, res) => {
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
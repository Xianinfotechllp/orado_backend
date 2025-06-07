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
    } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "All basic fields are required." });
    }

    // Check for existing user
    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      return res.status(409).json({ message: "Email or phone already in use." });
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
      userType: "merchant"
    });

    await newMerchant.save();

    res.status(201).json({ message: "Merchant registration submitted!" });
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


exports.createRestaurant = async (req, res) => {
  try {
    // 1️⃣ Required fields validation
    const requiredFields = [
      "name",
      "ownerName",
      "phone",
      "email",
      "password",
      "fssaiNumber",
      "gstNumber",
      "aadharNumber",
      "address.street",
      "address.city",
      "address.state",
      "foodType",
      "openingHours",
    ];

    const missingFields = requiredFields.filter((field) => {
      const nestedFields = field.split(".");
      let value = req.body;
      for (const f of nestedFields) {
        value = value?.[f];
        if (value === undefined) break;
      }
      return value === undefined || value === "";
    });

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
        code: "REQUIRED_FIELD_MISSING",
      });
    }

    if (req.body.password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
        code: "WEAK_PASSWORD",
      });
    }

    const validFoodTypes = ["veg", "non-veg", "both"];
    if (!validFoodTypes.includes(req.body.foodType.trim())) {
      return res.status(400).json({
        success: false,
        message: `Invalid foodType. Allowed: ${validFoodTypes.join(", ")}`,
        code: "INVALID_FOOD_TYPE",
      });
    }

    const validateTimeFormat = (time) => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    let openingHours = [];

    if (req.body.openingHours) {
      try {
        openingHours = typeof req.body.openingHours === 'string'
          ? JSON.parse(req.body.openingHours)
          : req.body.openingHours;
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid openingHours format. Must be valid JSON array',
          code: 'INVALID_OPENING_HOURS_FORMAT'
        });
      }

      if (!Array.isArray(openingHours)) {
        return res.status(400).json({
          success: false,
          message: 'openingHours must be an array',
          code: 'OPENING_HOURS_NOT_ARRAY'
        });
      }

      const errors = [];
      const seenDays = new Set();

      openingHours.forEach((daySchedule) => {
        const dayError = { day: daySchedule.day, errors: [] };

        if (seenDays.has(daySchedule.day)) {
          dayError.errors.push(`Duplicate entry for ${daySchedule.day}`);
          errors.push(dayError);
          return;
        }
        seenDays.add(daySchedule.day);

        if (!validDays.includes(daySchedule.day)) {
          dayError.errors.push(`Invalid day name. Allowed: ${validDays.join(', ')}`);
        }

        if (daySchedule.isClosed) {
          if (dayError.errors.length > 0) errors.push(dayError);
          return;
        }

        if (!daySchedule.openingTime || !validateTimeFormat(daySchedule.openingTime)) {
          dayError.errors.push('openingTime must be in HH:MM format');
        }

        if (!daySchedule.closingTime || !validateTimeFormat(daySchedule.closingTime)) {
          dayError.errors.push('closingTime must be in HH:MM format');
        }

        if (daySchedule.openingTime && daySchedule.closingTime) {
          if (daySchedule.closingTime <= '04:00' && daySchedule.openingTime > daySchedule.closingTime) {
            // Overnight case — valid
          } else if (daySchedule.openingTime >= daySchedule.closingTime) {
            dayError.errors.push('closingTime must be after openingTime');
          }
        }

        if (dayError.errors.length > 0) {
          errors.push(dayError);
        }
      });

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid opening hours data',
          code: 'INVALID_OPENING_HOURS_DATA',
          errors
        });
      }
    }

    const requiredDocs = {
      fssaiDoc: "FSSAI License",
      gstDoc: "GST Certificate",
      aadharDoc: "Aadhar Card",
    };

    const missingDocs = Object.keys(requiredDocs)
      .filter((doc) => !req.files?.[doc]?.[0])
      .map((doc) => requiredDocs[doc]);

    if (missingDocs.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing documents: ${missingDocs.join(", ")}`,
        code: "DOCUMENT_REQUIRED",
      });
    }

    const allowedPaymentMethods = ["online", "cod", "wallet"];
    let paymentMethods = req.body.paymentMethods;

    if (typeof paymentMethods === "string") {
      paymentMethods = paymentMethods.split(",").map((m) => m.trim());
    } else if (!paymentMethods) {
      paymentMethods = ["online"];
    }

    const invalidMethods = paymentMethods.filter(
      (m) => !allowedPaymentMethods.includes(m)
    );
    if (invalidMethods.length) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment methods: ${invalidMethods.join(
          ", "
        )}. Allowed: ${allowedPaymentMethods.join(", ")}`,
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    const fssaiDoc = await uploadOnCloudinary(req.files.fssaiDoc[0].path);
    const gstDoc = await uploadOnCloudinary(req.files.gstDoc[0].path);
    const aadharDoc = await uploadOnCloudinary(req.files.aadharDoc[0].path);

    if (!fssaiDoc || !gstDoc || !aadharDoc) {
      throw new Error("Document upload failed");
    }

    const slug = `${req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${req.body.address.city.toLowerCase()}-${Math.random().toString(36).substring(2, 6)}`;

    const restaurantData = {
      name: req.body.name.trim(),
      ownerName: req.body.ownerName.trim(),
      address: {
        street: req.body.address.street.trim(),
        city: req.body.address.city.trim(),
        state: req.body.address.state.trim(),
        zip: req.body.address.pincode || req.body.address.zip || "",
      },
      location: {
        type: "Point",
        coordinates: [
          parseFloat(req.body.address.longitude) || 0,
          parseFloat(req.body.address.latitude) || 0,
        ],
      },
      phone: req.body.phone.trim(),
      email: req.body.email.trim(),
      password: hashedPassword,
      openingHours,
      foodType: req.body.foodType.trim(),
      minOrderAmount: req.body.minOrderAmount || 100,
      paymentMethods,
      kyc: {
        fssaiNumber: req.body.fssaiNumber.trim(),
        gstNumber: req.body.gstNumber.trim(),
        aadharNumber: req.body.aadharNumber.trim(),
      },
      kycDocuments: {
        fssaiDocUrl: fssaiDoc.secure_url,
        gstDocUrl: gstDoc.secure_url,
        aadharDocUrl: aadharDoc.secure_url,
      },
      slug
    };

    const newRestaurant = await Restaurant.create(restaurantData);

    await Permission.create({
      restaurantId: newRestaurant._id,
      permissions: {
        canManageMenu: true,
        canAcceptOrder: false,
        canRejectOrder: false,
        canManageOffers: false,
        canViewReports: true,
      },
    });

    return res.status(201).json({
      success: true,
      code: "RESTAURANT_CREATED",
      data: {
        restaurantId: newRestaurant._id,
        approvalStatus: newRestaurant.approvalStatus,
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Something went wrong",
      error: err.message,
    });
  }
};
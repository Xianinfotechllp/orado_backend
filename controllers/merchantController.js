const User = require("../models/userModel");
const Session = require("../models/session");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require("mongoose");
const { uploadOnCloudinary } = require('../utils/cloudinary');
const Restaurant = require("../models/restaurantModel")


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
      "fssaiNumber",
      "ownerId",
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
      console.log(value)
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

    // Check if owner exists
    const ownerExists = await User.findById(req.body.ownerId);
    if (!ownerExists) {
      return res.status(400).json({
        success: false,
        message: "Owner does not exist",
        code: "INVALID_OWNER_ID",
      });
    }

    // Removed the check for existing restaurant for the same owner
    // Now owners can have multiple restaurants

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

    const fssaiDoc = await uploadOnCloudinary(req.files.fssaiDoc[0].path);
    const gstDoc = await uploadOnCloudinary(req.files.gstDoc[0].path);
    const aadharDoc = await uploadOnCloudinary(req.files.aadharDoc[0].path);

    if (!fssaiDoc || !gstDoc || !aadharDoc) {
      throw new Error("Document upload failed");
    }
    if (req.files?.images && req.files.images.length > 5) {
  return res.status(400).json({
    success: false,
    message: "Maximum 5 images allowed",
    code: "TOO_MANY_IMAGES",
  });
}


 let imageUrls = [];
    if (req.files?.images) {
      // Upload each image to Cloudinary
      const uploadPromises = req.files.images.map(file => 
        uploadOnCloudinary(file.path)
      );
      
      const uploadResults = await Promise.all(uploadPromises);
      imageUrls = uploadResults
        .filter(result => result !== undefined)
        .map(result => result.secure_url);
    }
    




    const slug = `${req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${req.body.address.city.toLowerCase()}-${Math.random().toString(36).substring(2, 6)}`;

    const restaurantData = {
      name: req.body.name.trim(),
      ownerId: req.body.ownerId, // Using the validated ownerId
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
      images: imageUrls,
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


exports.getRestaurantsByOwner = async(req,res) =>
{
  try {
    const { ownerId } = req.params;

    // Validate ownerId
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ success: false, message: "Invalid owner ID" });
    }

    const restaurants = await Restaurant.find({ ownerId })
      .select("-products -categories -offers -pointsHistory") // Exclude large/unnecessary fields
      .lean();

    if (!restaurants || restaurants.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "No restaurants found for this owner" 
      });
    }

    res.status(200).json({
      success: true,
      count: restaurants.length,
      data: restaurants
    });
  } catch (error) {
    console.error("Error fetching restaurants by owner:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
}



exports.getRestaurantApprovalStatus = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.restaurantId)
      .select('name approvalStatus approvalRejectionReason ownerId')


    if (!restaurant) {
      return res.status(404).json({
        success: false,
        error: 'Restaurant not found'
      });
    }

    // Verify the requesting merchant owns this restaurant
    if (restaurant.ownerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this restaurant'
      });
    }

    // Prepare response data
    const responseData = {
      id: restaurant._id,
      name: restaurant.name,
      approvalStatus: restaurant.approvalStatus,
      approvalRejectionReason: restaurant.approvalRejectionReason || null
    };

    res.status(200).json({
      success: true,
      data: responseData
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};



exports.getRestaurantApprovalStatus = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.restaurantId)
      .select('approvalStatus approvalRejectionReason')
      .lean();

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    res.json({
      status: restaurant.approvalStatus,
      rejectionReason: restaurant.approvalRejectionReason
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};





exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const merchantId = req.user._id; // Set by JWT middleware

    // Validate required fields
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password, new password, and confirmation are required.'
      });
    }

    // Check new password confirmation match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirmation do not match.'
      });
    }

    // Enforce password length
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.'
      });
    }

    // Fetch merchant by ID and userType
    const merchant = await User.findOne({ _id: merchantId, userType: 'merchant' });

    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant account not found.'
      });
    }

    // Verify existing password
    const isPasswordCorrect = await bcrypt.compare(currentPassword, merchant.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect.'
      });
    }

    // Prevent using the same password again
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from the current password.'
      });
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update merchant password and password change timestamp
    merchant.password = hashedPassword;
    merchant.passwordChangedAt = Date.now();
    await merchant.save();

    // Invalidate all other active sessions for this merchant (except current one)
    // await Session.deleteMany({
    //   userId: merchant._id,
    //   token: { $ne: req.token } // Assuming req.token contains the current JWT
    // });

    // Send password change notification email (if required)
    // await sendPasswordChangeNotification(merchant.email);

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.'
    });

  } catch (error) {
    console.error('Password change error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
      error: error.message
    });
  }
};




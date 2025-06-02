const User = require("../models/userModel");
const Order = require("../models/orderModel");
const Chat = require("../models/chatModel");
const Session = require("../models/session");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const otpGenerator = require("../utils/otpGenerator");
const { sendEmail } = require("../utils/sendEmail");
const { NotificationPreference, Notification } = require('../models/notificationModel');


const { sendSms } = require("../utils/sendSms");
const crypto = require("crypto");

// Register user with validations, OTP generation and notifications
exports.registerUser = async (req, res) => {
  try {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    const phoneRegex = /^\+91\d{10}$/;
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;

    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (!phoneRegex.test(phone)) {
      return res
        .status(400)
        .json({
          message: "Invalid phone number format. Use country code (+91)",
        });
    }

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters long, include an uppercase letter, a number, and a special character.",
      });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Email or phone number already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const phoneOtp = otpGenerator(6);
    const emailOtp = otpGenerator(6);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await sendEmail(email, "OTP Verification", `Your OTP is ${emailOtp}`);
    // await sendSms(phone, `Hi, your OTP is ${phoneOtp}`);

    const newUser = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      verification: {
        emailOtp,
        phoneOtp,
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
// Verify OTPs for both email and phone
exports.verifyOtp = async (req, res) => {
  try {
    const { email, phone, emailOtp, phoneOtp } = req.body;

    if (!email || !phone || !emailOtp || !phoneOtp) {
      return res
        .status(400)
        .json({ message: "Email, phone number, and OTPs are required" });
    }

    const user = await User.findOne({ $or: [{ email }, { phone }] });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.verification.emailOtp !== emailOtp) {
      return res.status(400).json({ message: "Invalid email OTP" });
    }

    if (user.verification.phoneOtp !== phoneOtp) {
      return res.status(400).json({ message: "Invalid phone OTP" });
    }

    if (user.verification.otpExpiry < new Date()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    user.verification.emailVerified = true;
    user.verification.phoneVerified = true;
    user.verification.emailOtp = null;
    user.verification.phoneOtp = null;
    user.verification.otpExpiry = null;

    await user.save();

    res.json({ message: "OTP verified successfully", userId: user._id });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Login user with JWT token generation and session management

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(email, password);

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

    const token = jwt.sign({ userId: userExist._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // Limit to 3 active sessions
    const MAX_SESSIONS = 3;
    const existingSessions = await Session.find({ userId: userExist._id }).sort(
      { createdAt: 1 }
    );

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

    const user = {
      _id: userExist._id,
      name: userExist.name,
      email: userExist.email,
      role: userExist.role,
    };

    res.json({
      message: "Logged in successfully",
      token,
      user,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Logout user by deleting session

exports.logoutUser = async (req, res) => {
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

exports.addAddress = async (req, res) => {
  try {
    const { userId, type, street, city, state, zip, longitude, latitude } =
      req.body;

    if (
      !street ||
      !city ||
      !state ||
      !zip ||
      !longitude ||
      !latitude ||
      !userId
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const userExist = await User.findById(userId);
    if (!userExist) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!userExist.addresses) {
      userExist.addresses = [];
    }

    userExist.addresses.push({
      type, // Home / Work / Other
      street,
      city,
      state,
      zip,
      location: {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      },
    });
    await userExist.save();
    res.json({
      message: "Address added successfully",
      addresses: userExist.addresses,
    });
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
    const { userId, addressId } = req.params;
    const { street, city, state, zip, longitude, latitude, type } = req.body;

    // Validate required fields
    if (!userId || !addressId) {
      return res.status(400).json({ message: "userId and addressId are required" });
    }

    // Validate optional fields if they exist
    if (street && typeof street !== "string") {
      return res.status(400).json({ message: "Street must be a string" });
    }
    if (city && typeof city !== "string") {
      return res.status(400).json({ message: "City must be a string" });
    }
    if (state && typeof state !== "string") {
      return res.status(400).json({ message: "State must be a string" });
    }
    if (zip && typeof zip !== "string") {
      return res.status(400).json({ message: "Zip must be a string" });
    }
    if (type && !["Home", "Work", "Other"].includes(type)) {
      return res.status(400).json({ message: "Type must be one of Home, Work, or Other" });
    }
    if ((longitude && typeof longitude !== "number") || (latitude && typeof latitude !== "number")) {
      return res.status(400).json({ message: "Longitude and latitude must be numbers" });
    }

    // Find the user
    const userExist = await User.findById(userId);
    if (!userExist) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find the address
    const address = userExist.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    // Only update fields if provided
    if (street) address.street = street;
    if (city) address.city = city;
    if (state) address.state = state;
    if (zip) address.zip = zip;
    if (type) address.type = type;
    if (longitude !== undefined && latitude !== undefined) {
      address.location = {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      };
    }

    await userExist.save();

    res.json({ message: "Address updated successfully", address });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
exports.getaddress = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const userExist = await User.findOne({ _id: userId });

    if (!userExist) {
      return res.status(404).json({ message: "User not found" });
    }

    // Map addresses to include latitude & longitude separately
    const formattedAddresses = userExist.addresses.map(address => {
      const [longitude, latitude] = address.location.coordinates;

      return {
        addressId: address._id,
        type: address.type,
        street: address.street,
        city: address.city,
        state: address.state,
        zip: address.zip,
        location: {
          latitude,
          longitude
        }
      };
    });

    res.json({ data: formattedAddresses });

  } catch (error) {
    console.error("Error fetching addresses:", error);
    res.status(500).json({ message: "Server error" });
  }
};
// Resend new OTPs
exports.resendOtp = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res
        .status(400)
        .json({ message: "Email or phone number is required" });
    }

    const user = await User.findOne({ $or: [{ email }, { phone }] });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentTime = new Date();
    const timeDifference = (currentTime - user.verification.otpExpiry) / 60000;

    if (timeDifference < 5) {
      return res
        .status(400)
        .json({ message: "You can only request a new OTP after 5 minutes" });
    }

    const emailOtp = otpGenerator(6);
    const phoneOtp = otpGenerator(6);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.verification.emailOtp = emailOtp;
    user.verification.phoneOtp = phoneOtp;
    user.verification.otpExpiry = otpExpiry;

    await user.save();

    await sendEmail(
      user.email,
      "OTP Verification",
      `Your new email OTP is ${emailOtp}`
    );
    await sendSms(user.phone, `Your new phone OTP is ${phoneOtp}`);

    res.json({ message: "OTP sent successfully to email and phone" });
  } catch (error) {
    console.error("Resend OTP Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "No user with that email" });
    }

    // Generate token (random hex string)
    const resetToken = crypto.randomBytes(20).toString("hex");

    // Set token and expiry (1 hour from now)
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;

    await user.save();

    // Construct reset URL for user - adjust your frontend URL here
    const resetUrl = `http://localhost:5000/reset-password/${resetToken}`;

    // Send email (implement sendEmail yourself or use nodemailer)
    await sendEmail(
      user.email,
      "Password Reset Request",
      `You requested a password reset. Click here to reset: ${resetUrl}`
    );

    res.json({ message: "Password reset email sent" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    // Find user by token and check if token is not expired
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    // Update user password and clear reset token fields
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// check for Gdpr
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Optional: Anonymize before deletion if logs/refs are required
    // await User.findByIdAndUpdate(userId, {
    //   name: "Deleted User",
    //   email: `deleted_${userId}@example.com`,
    //   phone: `deleted_${userId}`,
    //   password: "",
    //   address: {},
    //   verification: {},
    //   bankDetails: {},
    //   gst: "",
    //   fssai: "",
    //   deviceTokens: [],
    //   resetPasswordToken: undefined,
    //   resetPasswordExpires: undefined,
    // });

    // Hard delete the user
    await User.findByIdAndDelete(userId);

    // TODO: Optionally delete or anonymize related data from other collections (e.g., Orders, Referrals, etc.)

    res.json({
      message: "User data permanently deleted as per GDPR compliance",
    });
  } catch (error) {
    console.error("Delete User Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateNotificationPrefs = async (req, res) => {
  try {
    const userId = req.user._id;
    const updates = req.body;

    const allowedKeys = [
      "orderUpdates",
      "promotions",
      "walletCredits",
      "newFeatures",
      "serviceAlerts"
    ];

    const hasValidKey = Object.keys(updates).some(key => allowedKeys.includes(key));
    if (!hasValidKey) {
      return res.status(400).json({ error: "No valid notification preference keys provided" });
    }

    let prefs = await NotificationPreference.findOne({ userId });
    if (!prefs) {
      prefs = new NotificationPreference({ userId });
    }

    for (const key of allowedKeys) {
      if (updates.hasOwnProperty(key)) {
        prefs[key] = updates[key];
      }
    }

    await prefs.save();

    return res.status(200).json({
      message: "Notification preferences updated successfully",
      notificationPrefs: prefs
    });
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    res.status(500).json({ error: "Server error while updating notification preferences" });
  }
};

exports.getNotificationPrefs = async (req, res) => {
  try {
    const userId = req.user._id;

    let prefs = await NotificationPreference.findOne({ userId });

    if (!prefs) {
      prefs = new NotificationPreference({
        userId,
        orderUpdates: true,
        promotions: true,
        walletCredits: true,
        newFeatures: true,
        serviceAlerts: true,
      });
      await prefs.save();
    }

    return res.status(200).json({
      message: "Notification preferences fetched successfully",
      notificationPrefs: prefs
    });
  } catch (error) {
    console.error("Error fetching notification preferences:", error);
    res.status(500).json({ error: "Server error while fetching notification preferences" });
  }
};



// Delete user account
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id; // Assumes user is authenticated and req.user is populated

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Delete related data
    await Promise.all([
      Order.deleteMany({ customerId: userId }),
      Chat.deleteMany({ user: userId }),
      // Add more deletions if needed, e.g., Reviews, Addresses, etc.
    ]);

    // Delete the user
    await User.findByIdAndDelete(userId);

    return res.status(200).json({ message: "Account and related data deleted successfully" });
  } catch (error) {
    console.error("Delete account error:", error);
    return res.status(500).json({ message: "Server error while deleting account" });
  }
};

// get user notifications
exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user notification preferences
    const prefs = await NotificationPreference.findOne({ userId });
    if (!prefs) {
      return res.status(404).json({ message: 'Notification preferences not found' });
    }

    // Get enabled types (e.g., { promotions: true, orderUpdates: false } → ['promotions'])
    const enabledTypes = Object.entries(prefs.toObject())
      .filter(([key, value]) => value === true)
      .map(([key]) => key);

    // Fetch notifications that match enabled types
    const notifications = await Notification.find({
      userId,
      type: { $in: enabledTypes },
    }).sort({ createdAt: -1 });

    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
};


// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const notificationId = req.params.id;
    await Notification.findByIdAndUpdate(notificationId, { read: true });
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Failed to update notification' });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    await Notification.updateMany(
      { userId, read: false },
      { $set: { read: true } }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Failed to update notifications' });
  }
};


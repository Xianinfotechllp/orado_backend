const User = require("../../../../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const otpGenerator = require("../utils/otpGenerator");
const { sendEmail } = require("../utils/sendEmail");
const { sendSms } = require("../utils/sendSms");
const Favourite = require("../../../../models/favouriteModel")
const Restaurant = require("../../../../models/restaurantModel")
const mongoose = require('mongoose')
const { toStringSafe } = require("../utils/toStringSafe");
const PromoCode = require("../../../../models/promoCodeModels");
const { isValidObjectId } = require("mongoose");

const LoyaltyPointTransaction = require("../../../../models/loyaltyTransactionModel")
// Register user with validations, OTP generation and notifications
exports.registerUser = async (req, res) => {
  try {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    const phoneRegex = /^\+91\d{10}$/;
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;

    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res
        .status(400)
        .json({
          message: "All fields are required",
          messageType: "failure",
          userId: "",
        });
    }

    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({
          message: "Invalid email format",
          messageType: "failure",
          userId: "",
        });
    }

    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        message: "Invalid phone number format. Use country code (+91)",

        messageType: "failure",
        userId: "",
      });
    }

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters long, include an uppercase letter, a number, and a special character.",
        messageType: "failure",
        userId: "",
      });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({
        message: "Email or phone number already registered",

        messageType: "failure",
        userId: "",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const phoneOtp = otpGenerator(6);
    const emailOtp = otpGenerator(6);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // await sendEmail(email, "OTP Verification", `Your OTP is ${emailOtp}`);
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
      messageType: "success",
      userId: newUser._id,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Server error", messageType: "failure", userId: "" ,error: error.message });
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



exports.getUserDetails = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing User ID",
        messageType: "failure"
      });
    }

    const user = await User.findById(userId)
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        messageType: "failure"
      });
    }

    // Helper to safely convert any value to string (including null/undefined)


    // Format addresses with string lat/lon
    const formattedAddresses = (user.addresses || []).map(addr => {
      let lat = "";
      let lon = "";

      if (addr.location && Array.isArray(addr.location.coordinates)) {
        [lon, lat] = addr.location.coordinates;
      }

      return {
        addressId: toStringSafe(addr._id),
        type: toStringSafe(addr.type),
        street: toStringSafe(addr.street),
        city: toStringSafe(addr.city),
        state: toStringSafe(addr.state),
        zip: toStringSafe(addr.zip),
        location: {
          latitude: toStringSafe(lat),
          longitude: toStringSafe(lon)
        }
      };
    });

    // Construct final response object — all values stringified
    const userDetails = {
      userId: toStringSafe(user._id),
      name: toStringSafe(user.name),
      email: toStringSafe(user.email),
      phone: toStringSafe(user.phone),
      userType: toStringSafe(user.userType),
      profilePicture: toStringSafe(user.profilePicture),
      walletBalance: toStringSafe(user.walletBalance),
      loyaltyPoints: toStringSafe(user.loyaltyPoints),
      addresses: formattedAddresses,
      deviceTokens: (user.deviceTokens || []).map(toStringSafe),
      lastActivity: toStringSafe(user.lastActivity),
      createdAt: toStringSafe(user.createdAt),
      updatedAt: toStringSafe(user.updatedAt)
    };

    // Send final success response
    return res.status(200).json({
      success: true,
      message: "User details fetched successfully",
      messageType: "success",
      data: userDetails
    });

  } catch (error) {
    console.error("Error fetching user details:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong on the server",
      messageType: "failure"
    });
  }
};





exports.updateUserDetails = async (req, res) => {
  try {
    const userId = req.user._id;
  console.log(userId )
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing User ID",
        messageType: "failure",
      });
    }

    // Dynamic update fields
    const updateFields = {};
    if (req.body.name !== undefined) updateFields.name = toStringSafe(req.body.name);
    if (req.body.email !== undefined) updateFields.email = toStringSafe(req.body.email);
    if (req.body.phone !== undefined) updateFields.phone = toStringSafe(req.body.phone);
    if (req.body.profilePicture !== undefined) updateFields.profilePicture = toStringSafe(req.body.profilePicture);

    // // If no fields sent — reject request
    // if (Object.keys(updateFields).length === 0) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "No valid fields provided for update",
    //     messageType: "failure",
    //   });
    // }

    updateFields.updatedAt = new Date();

    const updatedUser = await User.findByIdAndUpdate(userId, updateFields, {
      new: true,
    })
      .select("-password -resetPasswordToken -resetPasswordExpires")
      .lean();

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        messageType: "failure",
      });
    }

    // Format addresses
    const formattedAddresses = (updatedUser.addresses || []).map((addr) => {
      let lat = null, lon = null;
      if (addr.location && Array.isArray(addr.location.coordinates)) {
        [lon, lat] = addr.location.coordinates;
      }

      return {
        addressId: toStringSafe(addr._id),
        type: toStringSafe(addr.type),
        street: toStringSafe(addr.street),
        city: toStringSafe(addr.city),
        state: toStringSafe(addr.state),
        zip: toStringSafe(addr.zip),
        location: {
          latitude: toStringSafe(lat),
          longitude: toStringSafe(lon),
        },
      };
    });

    const userDetails = {
      userId: toStringSafe(updatedUser._id),
      name: toStringSafe(updatedUser.name),
      email: toStringSafe(updatedUser.email),
      phone: toStringSafe(updatedUser.phone),
      userType: toStringSafe(updatedUser.userType),
      profilePicture: toStringSafe(updatedUser.profilePicture),
      walletBalance: toStringSafe(updatedUser.walletBalance),
      loyaltyPoints: toStringSafe(updatedUser.loyaltyPoints),
      addresses: formattedAddresses,
      deviceTokens: (updatedUser.deviceTokens || []).map(toStringSafe),
      lastActivity: toStringSafe(updatedUser.lastActivity),
      createdAt: toStringSafe(updatedUser.createdAt),
      updatedAt: toStringSafe(updatedUser.updatedAt),
    };

    return res.status(200).json({
      success: true,
      message: "User details updated successfully",
      messageType: "success",
      data: userDetails,
    });

  } catch (error) {
    console.error("Error updating user details:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong on the server",
      messageType: "failure",
    });
  }
};



exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",

        messageType: "failure",
        userId: "",
      });
    }

    const userExist = await User.findOne({ email });
    if (!userExist) {
      return res.status(400).json({
        message: "User not found",

        messageType: "failure",
        userId: "",
      });
    }

    const isMatch = await bcrypt.compare(password, userExist.password);
    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials",

        messageType: "failure",
        userId: "",
      });
    }

  const token = jwt.sign({ userId: userExist._id }, process.env.JWT_SECRET);

    // Create a safe user object without password
    const user = {
      _id: userExist._id,
      name: userExist.name,
      email: userExist.email,
      role: userExist.role, // if you have roles like admin/customer etc.
    };

    res.json({
      message: "Logged in successfully",
      messageType: "success",
      token:token,
      userId: user._id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", messageType: "failure" ,
             messageType: "failure",
              userId: "",
    });
  }
};

exports.addAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { 
      type = "Home",
      street,
      city,
      state,
      zip,
      longitude,
      latitude,
      displayName,
      receiverName,
      receiverPhone,
      area,
      directionsToReach   // New optional field
    } = req.body;

    // Validate required fields
    const requiredFields = { street, city, state, zip, longitude, latitude, userId };
    const missingFields = Object.entries(requiredFields)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`,
        messageType: "failure"
      });
    }

    // Validate coordinates
    if (isNaN(longitude) || isNaN(latitude)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coordinates",
        messageType: "failure"
      });
    }

    // Check if user exists
    const userExist = await User.findById(userId);
    if (!userExist) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        messageType: "failure"
      });
    }

    // Initialize addresses array if it doesn't exist
    if (!userExist.addresses) {
      userExist.addresses = [];
    }

    // Create new address object
    const newAddress = {
      type: type.charAt(0).toUpperCase() + type.slice(1),
      street,
      city,
      state,
      zip,
      area: area || undefined,
      displayName: displayName || `${type} address`,
      location: {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      },
      ...(receiverName && { receiverName }),
      ...(receiverPhone && { receiverPhone }),
      ...(directionsToReach && { directionsToReach })  // Include if provided
    };

    // Add the new address
    userExist.addresses.push(newAddress);
    await userExist.save();

    return res.status(200).json({
      success: true,
      message: "Address added successfully",
      messageType: "success"
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      messageType: "failure"
    });
  }
};

exports.getUserDetails = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing User ID",
        messageType: "failure"
      });
    }

    const user = await User.findById(userId)
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        messageType: "failure"
      });
    }

    // Helper to safely convert any value to string (including null/undefined)
    const toStringSafe = (value) => (value !== undefined && value !== null) ? String(value) : "";

    // Format addresses with string lat/lon
    const formattedAddresses = (user.addresses || []).map(addr => {
      let lat = "";
      let lon = "";

      if (addr.location && Array.isArray(addr.location.coordinates)) {
        [lon, lat] = addr.location.coordinates;
      }

      return {
        addressId: toStringSafe(addr._id),
        type: toStringSafe(addr.type),
        street: toStringSafe(addr.street),
        city: toStringSafe(addr.city),
        state: toStringSafe(addr.state),
        zip: toStringSafe(addr.zip),
        location: {
          latitude: toStringSafe(lat),
          longitude: toStringSafe(lon)
        }
      };
    });

    // Construct final response object — all values stringified
    const userDetails = {
      userId: toStringSafe(user._id),
      name: toStringSafe(user.name),
      email: toStringSafe(user.email),
      phone: toStringSafe(user.phone),
      userType: toStringSafe(user.userType),
      profilePicture: toStringSafe(user.profilePicture),
      walletBalance: toStringSafe(user.walletBalance),
      loyaltyPoints: toStringSafe(user.loyaltyPoints),
      addresses: formattedAddresses,
      deviceTokens: (user.deviceTokens || []).map(toStringSafe),
      lastActivity: toStringSafe(user.lastActivity),
      createdAt: toStringSafe(user.createdAt),
      updatedAt: toStringSafe(user.updatedAt)
    };

    // Send final success response
    return res.status(200).json({
      success: true,
      message: "User details fetched successfully",
      messageType: "success",
      data: userDetails
    });

  } catch (error) {
    console.error("Error fetching user details:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong on the server",
      messageType: "failure"
    });
  }
};

exports.getAddress = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
        messageType: "failure"
      });
    }

    const userExist = await User.findById(userId);

    if (!userExist) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        messageType: "failure"
      });
    }

    const formattedAddresses = (userExist.addresses || []).map(address => {
      let latitude = null;
      let longitude = null;

      if (address.location && Array.isArray(address.location.coordinates)) {
        [longitude, latitude] = address.location.coordinates;
      }

      // Build address string
      const parts = [
        address.street,
        address.area,
        address.city,
        address.state,
        address.zip
      ].filter(Boolean); // removes undefined/null/empty

      const addressString = parts.join(", ");

      return {
        addressId: address._id,
        type: address.type || "",
        displayName: address.displayName || "",
        street: address.street || "",
        area: address.area || "",
        city: address.city || "",
        state: address.state || "",
        zip: address.zip || "",
        receiverName: address.receiverName || "",
        receiverPhone: address.receiverPhone || "",
        directionsToReach: address.directionsToReach || "",
        isDefault: address.isDefault || "",
        location: {
          latitude,
          longitude
        },
        addressString // include the clean, formatted address
      };
    });

    return res.status(200).json({
      success: true,
      message: "Addresses fetched successfully",
      messageType: "success",
      addresses: formattedAddresses
    });

  } catch (error) {
    console.error("Error fetching addresses:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong on the server",
      messageType: "failure"
    });
  }
};
exports.updateAddressById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { addressId } = req.params;
    const {
      street, city, state, zip, longitude, latitude,
      area, receiverName, receiverPhone, displayName,
      directionsToReach, isDefault
    } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
        messageType: "failure"
      });
    }

    const userExist = await User.findById(userId);
    if (!userExist) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        messageType: "failure"
      });
    }

    const address = userExist.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
        messageType: "failure"
      });
    }

    // Update only provided fields
    if (street !== undefined) address.street = street;
    if (city !== undefined) address.city = city;
    if (state !== undefined) address.state = state;
    if (zip !== undefined) address.zip = zip;
    if (area !== undefined) address.area = area;
    if (receiverName !== undefined) address.receiverName = receiverName;
    if (receiverPhone !== undefined) address.receiverPhone = receiverPhone;
    if (displayName !== undefined) address.displayName = displayName;
    if (directionsToReach !== undefined) address.directionsToReach = directionsToReach;
    if (isDefault !== undefined) address.isDefault = isDefault;

    if (longitude !== undefined && latitude !== undefined) {
      address.location = {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      };
    }

    await userExist.save();

    // Format updated addresses
    const updatedAddresses = (userExist.addresses || []).map(addr => {
      let lat = null;
      let lon = null;

      if (addr.location && Array.isArray(addr.location.coordinates)) {
        [lon, lat] = addr.location.coordinates;
      }

      const parts = [
        addr.street,
        addr.area,
        addr.city,
        addr.state,
        addr.zip
      ].filter(Boolean);

      const addressString = parts.join(", ");

      return {
        addressId: addr._id,
        type: addr.type || null,
        displayName: addr.displayName || null,
        street: addr.street || null,
        area: addr.area || null,
        city: addr.city || null,
        state: addr.state || null,
        zip: addr.zip || null,
        receiverName: addr.receiverName || null,
        receiverPhone: addr.receiverPhone || null,
        directionsToReach: addr.directionsToReach || null,
        isDefault: addr.isDefault || false,
        location: {
          latitude: lat,
          longitude: lon
        },
        addressString
      };
    });

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
      messageType: "success"
    });

  } catch (error) {
    console.error("Error updating address:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong on the server",
      messageType: "failure"
    });
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

    // Validate email is provided
    if (!email) {
      return res.status(400).json({
        message: "Email is required.",
        messageType: "failure",
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: "No user with that email.",
        messageType: "failure",
      });
    }
 
 const otp = Math.floor(10000 + Math.random() * 90000).toString();
 

    // Set OTP, expiry (5 mins), and reset otpVerified flag
    user.resetPasswordToken = otp;
    user.resetPasswordExpires = Date.now() + 5 * 60 * 1000;
    user.forgotPasswordOtpVerified = false; // reset it when sending a new otp

    await user.save();

    // Send email with OTP
    const emailResult = await sendEmail(
      user.email,
      "Your Password Reset OTP",
      `Your OTP for password reset is: ${otp}. It will expire in 5 minutes.`
    );

    console.log("Email sent:", emailResult);

    if (!emailResult.accepted || !emailResult.accepted.length) {
      return res.status(500).json({
        message: "Failed to deliver OTP email.",
        messageType: "failure",
      });
    }

    // Success Response
    res.status(200).json({
      message: "OTP sent to your email.",
      messageType: "success",
      userId: user._id,
    });

  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      message: "Server error.",
      messageType: "failure",
    });
  }
};

exports.verifyForgotPasswordOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validate required fields
    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required.",
        messageType: "failure",
      });
    }

    // Find user by email
    const user = await User.findOne({
      email,
      resetPasswordToken: otp,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired OTP.",
        messageType: "failure",
      });
    }

    // Mark OTP as verified
    user.forgotPasswordOtpVerified = true;
    await user.save();

    res.status(200).json({
      message: "OTP verified successfully.",
      messageType: "success",
      userId: user._id,
    });

  } catch (error) {
    console.error("Verify forgot password OTP error:", error);
    res.status(500).json({
      message: "Server error.",
      messageType: "failure",
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { newPassword, email } = req.body;

    if (!newPassword || !email) {
      return res.status(400).json({
        message: "Email and new password are required.",
        messageType: "failure",
      });
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters long, include an uppercase letter, a number, and a special character.",
        messageType: "failure",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
        messageType: "failure",
      });
    }

    // Check if OTP was verified before resetting password
    if (!user.forgotPasswordOtpVerified) {
      return res.status(400).json({
        message: "OTP verification required before resetting password.",
        messageType: "failure",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    // Clear OTP fields after password reset
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.forgotPasswordOtpVerified = false;

    await user.save();

    res.status(200).json({
      message: "Password reset successful.",
      messageType: "success",
    });

  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      message: "Server error.",
      messageType: "failure",
    });
  }
};


exports.sendLoginOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        message: "Phone number is required",
        messageType: "failure",
      });
    }

    // Check if user exists
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        message: "Phone number not registered",
        messageType: "failure",
      });
    }

    // Generate 5-digit OTP
    const otp = Math.floor(10000 + Math.random() * 90000).toString();

    // Set expiry 5 mins from now
    const expiry = new Date(Date.now() + 5 * 60 * 1000);

    // Save OTP and expiry as loginOtp
    user.loginOtp = otp;
    user.loginOtpExpiresAt = expiry;
    await user.save();

    // Try to send SMS
    try {
      await sendSms(phone, `Your OTP is ${otp}`);
      // SMS sent successfully
      return res.status(200).json({
        message: "OTP sent successfully",
        messageType: "success",
      });
    } catch (smsError) {
      console.error("SMS sending failed:", smsError);
      // Fallback: OTP not sent by SMS but still return success with warning
      return res.status(200).json({
        message:
          "OTP generated successfully but failed to send SMS. Please try again or contact support.",
        messageType: "failure",
      });
    }
  } catch (error) {
    console.error("Error in sendLoginOtp:", error);
    res.status(500).json({
      message: "Server Error",
      messageType: "failure",
    });
  }
};



exports.verifyLoginOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        message: "Phone number and OTP are required",
        messageType: "failure",
      });
    }

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        messageType: "failure",
      });
    }

    if (
      user.loginOtp !== otp ||
      !user.loginOtpExpiresAt ||
      user.loginOtpExpiresAt < new Date()
    ) {
      return res.status(400).json({
        message: "Invalid or expired OTP",
        messageType: "failure",
      });
    }

    // Clear OTP fields after successful verification
    user.loginOtp = null;
    user.loginOtpExpiresAt = null;
    await user.save();

    // Generate JWT token
    const payload = {
      userId: user._id,
      phone: user.phone,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "7d", // token valid for 7 days, change as needed
    });



    return res.status(200).json({
      message: "Logged in successfull with phone number",
      messageType: "success",
      token:token, // send token to client
      userId: user._id,
    });
  } catch (error) {
    console.error("Error in verifyLoginOtp:", error);
    return res.status(500).json({
      message: "Server error",
      messageType: "failure",
    });
  }
};





exports.addFavouriteRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.body;
    const userId = req.user._id; // Assuming JWT middleware sets req.user

    if (!restaurantId) {
      return res.status(400).json({ message: 'restaurantId is required', messageType: "failure" });
    }

    // Check if restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found', messageType: "failure" });
    }

    // Check if already added to favourites
    const alreadyFavourite = await Favourite.findOne({ user: userId, item: restaurantId, itemType: 'Restaurant' });
    if (alreadyFavourite) {
      return res.status(400).json({ message: 'Restaurant already in favourites', messageType: "failure" });
    }

    // Add to favourites
    const newFavourite = new Favourite({
      user: userId,
      item: restaurantId,
      itemType: 'Restaurant'  // IMPORTANT: set this to 'Restaurant'
    });

    await newFavourite.save();

    res.status(201).json({ message: 'Added to favourites successfully', messageType: "success", data: newFavourite });

  } catch (error) {
    console.error('Error adding favourite:', error);
    res.status(500).json({ message: 'Internal Server Error', messageType: "failure" });
  }
};



exports.removeFavouriteRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.body;
    const userId = req.user._id; // Assuming JWT middleware sets req.user

    if (!restaurantId) {
      return res.status(400).json({ message: 'restaurantId is required', messageType: "failure" });
    }

    // Find and delete the favourite entry
    const deleted = await Favourite.findOneAndDelete({
      user: userId,
      item: restaurantId,
      itemType: 'Restaurant'
    });

    if (!deleted) {
      return res.status(404).json({ message: 'Favourite restaurant not found', messageType: "failure" });
    }

    res.status(200).json({ message: 'Removed from favourites successfully', messageType: "success" });

  } catch (error) {
    console.error('Error removing favourite:', error);
    res.status(500).json({ message: 'Internal Server Error', messageType: "failure" });
  }
};


// exports.getFavouriteRestaurants = async (req, res) => {
//   try {
//     const userId = req.user._id; // Assuming JWT middleware sets req.user

//     // Find favourites for user where itemType is 'Restaurant' and populate restaurant details
//     const favourites = await Favourite.find({ user: userId, itemType: 'Restaurant' })
//       .populate('item', 'name location cuisine rating images') // select restaurant fields you want
//       .exec();

//     // Map to return only the restaurant data inside favourites
//     const favouriteRestaurants = favourites.map(fav => fav.item);

//     res.status(200).json({ 
//       message: 'Favourite restaurants fetched successfully',
//       messageType: "success",
//       data: favouriteRestaurants 
//     });

//   } catch (error) {
//     console.error('Error fetching favourites:', error);
//     res.status(500).json({ message: 'Internal Server Error', messageType: "failure" });
//   }
// };



exports.getFavouriteRestaurants = async (req, res) => {
  try {
    const userId = req.user._id;
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const userCoords = (!isNaN(lat) && !isNaN(lng)) ? [lng, lat] : null;
    
    const currentTime = new Date();
    const currentDay = currentTime.toLocaleString('en-US', { weekday: 'long' }).toLowerCase();
    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentTimeString = `${currentHours.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;

    const favourites = await Favourite.find({ user: userId, itemType: 'Restaurant' })
      .populate('item', 'name images rating openingHours active')
      .exec();

    const favouriteRestaurants = await Promise.all(favourites.map(async (fav) => {
      const restaurant = fav.item;
      if (!restaurant) return null;
      
      // Delivery area check (as string "1" or "0")
      let outOfDeliveryArea = "0";
      if (userCoords && restaurant) {
        try {
          const isInside = await isPointInsideServiceAreas(userCoords, restaurant._id);
          outOfDeliveryArea = isInside ? "0" : "1";
        } catch (error) {
          console.error('Error checking service area:', error);
          outOfDeliveryArea = "0";
        }
      }

      // Open/closed status check (as string "1" or "0")
      let isOpen = "0";
      if (restaurant.active && restaurant.openingHours) {
        const todayHours = restaurant.openingHours.find(
          hours => hours.day === currentDay
        );
        
        if (todayHours && !todayHours.isClosed) {
          const openingTime = todayHours.openingTime;
          const closingTime = todayHours.closingTime;
          
          if (currentTimeString >= openingTime && currentTimeString <= closingTime) {
            isOpen = "1";
          }
        }
      }

      return {
        _id: restaurant._id.toString(),
        name: restaurant.name,
        images: restaurant.images || [],
        rating: restaurant.rating,
        outOfDeliveryArea: outOfDeliveryArea,  // Will be "1" or "0"
        isOpen: isOpen  // Will be "1" or "0"
      };
    }));

    const validRestaurants = favouriteRestaurants.filter(rest => rest !== null);

    res.status(200).json({
      message: 'Favourite restaurants fetched successfully',
      messageType: "success",
      data: validRestaurants
    });

  } catch (error) {
    console.error('Error fetching favourites:', error);
    res.status(500).json({ 
      message: 'Internal Server Error', 
      messageType: "failure",
      data: [] 
    });
  }
};





exports.updateUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    // Build the update object based on what fields are present in req.body
    const updateFields = {};
    if (req.body.name !== undefined) updateFields.name = req.body.name;
    if (req.body.email !== undefined) updateFields.email = req.body.email;
    if (req.body.phone !== undefined) updateFields.phone = req.body.phone;

    // Return an error if no fields are provided
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateFields,
      { new: true, runValidators: true }
    ).select("name email phone");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "User profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};





exports.deleteAddressById = async (req, res) => {
  try {
    const userId = req.user._id;
    const addressId = req.params.addressId;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID or address ID",
        messageType: "failure",
      });
    }

    // Find user and remove address by its _id
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId },
      { $pull: { addresses: { _id: addressId } } },
      { new: true }
    )
    .select('-password -resetPasswordToken -resetPasswordExpires')
    .lean();

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        messageType: "failure",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Address deleted successfully",
      messageType: "success",
  
    });

  } catch (error) {
    console.error("Error deleting address:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong on the server",
      messageType: "failure",
    });
  }
};








exports.getUserLoyaltyBalance = async (req, res) => {
  try {
    const  userId  = req.user._id;

    const user = await User.findById(userId).select("loyaltyPoints");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Loyalty points fetched successfully",
      data: { loyaltyPoints: user.loyaltyPoints }
    });

  } catch (error) {
    console.error("Error fetching loyalty points:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch loyalty points"
    });
  }
};





// Get loyalty transaction history for the logged-in user
exports.getLoyaltyTransactionHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    const transactions = await LoyaltyPointTransaction.find({ customerId: userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Loyalty transaction history fetched successfully.",
      data: transactions,
    });
  } catch (error) {
    console.error("Error fetching loyalty transaction history:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch loyalty transaction history.",
    });
  }
};

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
exports.getPromoCodesForCustomerAndRestaurant = async (req, res) => {
  try {
    const customerId = req.user._id;
    const { restaurantId } = req.params;
    const now = new Date();

    // Fetch only valid promo codes for current time and matching rules
    const promoCodes = await PromoCode.find({
      isActive: true,
      validFrom: { $lte: now },
      validTill: { $gte: now },
      $or: [
        {
          isMerchantSpecific: false,
          isCustomerSpecific: false
        },
        {
          isMerchantSpecific: true,
          applicableMerchants: new mongoose.Types.ObjectId(restaurantId)
        },
        {
          isCustomerSpecific: true,
          applicableCustomers: new mongoose.Types.ObjectId(customerId)
        }
      ]
    }).lean(); // Use lean() for better performance

    // Filter: Allow only if customer hasn't exceeded usage
    const eligiblePromoCodes = promoCodes.filter((promo) => {
      if (promo.maxUsagePerCustomer === 0) return true;

      const usageCount = promo.customersUsed.filter(
        (id) => id.toString() === customerId.toString()
      ).length;

      return usageCount < promo.maxUsagePerCustomer;
    });

    // Format dates to human-readable strings
    const formattedPromoCodes = eligiblePromoCodes.map(promo => ({
      ...promo,
      validFrom: formatDate(promo.validFrom),
      validTill: formatDate(promo.validTill),
      createdAt: formatDate(promo.createdAt),
      updatedAt: formatDate(promo.updatedAt)
    }));

    return res.status(200).json({ promoCodes: formattedPromoCodes });
  } catch (error) {
    console.error("Error fetching promo codes:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};






exports.saveCustomerToken = async (req, res) => {
  try {
    const userId = req.user._id;
    const { token, platform = 'android', appVersion } = req.body; // Removed deviceId

    // Validate input
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if token already exists (now only checks token)
    const existingDeviceIndex = user.devices.findIndex(
      d => d.token === token // Only compare by token
    );

    if (existingDeviceIndex !== -1) {
      // Update existing device
      user.devices[existingDeviceIndex] = {
        ...user.devices[existingDeviceIndex],
        token,
        platform,
        appVersion,
        lastActive: new Date(),
        status: 'active',
      };
    } else {
      // Add new device
      user.devices.push({
        token,
        platform,
        appVersion,
        lastActive: new Date(),
        status: 'active',
      });
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Device token registered successfully',
      deviceCount: user.devices.length
    });

  } catch (error) {
    console.error('Error saving customer token:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Remove FCM token for customer (user)
exports.removeCustomerToken = async (req, res) => {
  try {

    const userId = req.user._id;
    const { token } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Remove the token
    const initialCount = user.devices.length;
    user.devices = user.devices.filter(d => d.token !== token);

    if (user.devices.length === initialCount) {
      return res.status(404).json({
        success: false,
        message: 'Token not found for this user'
      });
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Device token removed successfully',
      deviceCount: user.devices.length
    });

  } catch (error) {
    console.error('Error removing customer token:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

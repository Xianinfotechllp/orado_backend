const User = require("../models/userModel");
const Session = require("../models/session");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require("mongoose");
const { uploadOnCloudinary } = require('../utils/cloudinary');
const Restaurant = require("../models/restaurantModel")
const Order = require('../models/orderModel')
const moment = require("moment")
const Permission = require("../models/restaurantPermissionModel")
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

// Get merchant details
exports.getMerchantDetails = async (req, res) => {
  try {
     const merchantId = req.user._id;

    if (!merchantId) {
      return res.status(400).json({ message: "Merchant ID is required." });
    }

    // Find merchant by ID, excluding sensitive information
    const merchant = await User.findById(merchantId)
      .select('-password -__v -createdAt -updatedAt')
      .lean();

    if (!merchant || merchant.userType !== 'merchant') {
      return res.status(404).json({ message: "Merchant not found  ." });
    }


    res.status(200).json(merchant);
  } catch (err) {
    console.error("Get merchant details error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
};


exports.loginMerchant = async (req, res) => {
  try {
    const { identifier, password, fcmToken } = req.body; // identifier = email or phone

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

    // Create JWT token
    const token = jwt.sign(
      { userId: userExist._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 🔹 Save FCM token if provided
    if (fcmToken) {
      if (!userExist.deviceTokens.includes(fcmToken)) {
        userExist.deviceTokens.push(fcmToken);
        await userExist.save();
      }
    }

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: userExist._id,
        name: userExist.name,
        email: userExist.email,
        phone: userExist.phone,
        userType: userExist.userType,
        deviceTokens: userExist.deviceTokens
      }
    });
  } catch (err) {
    console.error("Merchant login error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Logout user by deleting session

exports.logoutMerchant = async (req, res) => {
  try {
    const userId = req.user._id; // From JWT middleware
    const { fcmToken } = req.body; // FCM token to remove

    if (!fcmToken) {
      return res.status(400).json({ message: "FCM token is required to logout." });
    }

    // Remove token from deviceTokens array
    await User.updateOne(
      { _id: userId },
      { $pull: { deviceTokens: fcmToken } }
    );

    res.status(200).json({
      success: true,
      message: "Logout successful and FCM token removed."
    });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
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





exports.getOrdersByCustomer = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "Customer ID is required" });
    }

    const orders = await Order.find({ customerId: userId })
      .populate("restaurantId", "name location address")
      .populate("assignedAgent", "fullName phone")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });
  } catch (err) {
    console.error("Error fetching orders by customer:", err);
    res.status(500).json({ success: false, error: "Failed to fetch customer orders" });
  }
};





exports.getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate([
        { path: "customerId" },
        { path: "restaurantId" },
        { path: "assignedAgent" },
        { path: "orderItems.productId" }
      ])
      .lean();

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // clean up sensitive / unnecessary fields
    const sanitizedOrder = {
      _id: order._id,
      orderTime: order.orderTime,
      deliveryTime: order.deliveryTime,
      orderStatus: order.orderStatus,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      subtotal: order.subtotal,
      totalAmount: order.totalAmount,
      deliveryMode: order.deliveryMode,
      preparationTime: order.preparationTime,
      instructions: order.instructions,
      scheduledTime: order.scheduledTime,
      deliveryCharge: order.deliveryCharge,

      customer: {
        _id: order.customerId._id,
        name: order.customerId.name,
        email: order.customerId.email,
        phone: order.customerId.phone,
        addresses: order.customerId.addresses,  // if needed
      },

      restaurant: {
        _id: order.restaurantId._id,
        name: order.restaurantId.name,
        images: order.restaurantId.images,
        phone: order.restaurantId.phone,
        address: order.restaurantId.address,
      },

      assignedAgent: order.assignedAgent
        ? {
            _id: order.assignedAgent._id,
            name: order.assignedAgent.name,
            phone: order.assignedAgent.phone
          }
        : null,

      orderItems: order.orderItems.map((item) => ({
        _id: item._id,
        name: item.name,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        image: item.image,
        productId: item.productId?._id,
      })),

      // if needed
      offerName: order.offerName,
      offerDiscount: order.offerDiscount,
      tax: order.tax,
      discountAmount: order.discountAmount
    };

    res.json({ message: "Order fetched", data: sanitizedOrder });

  } catch (err) {
    console.error("Error fetching order:", err.stack);
    res.status(500).json({ message: "Error fetching order", error: err.message });
  }
};





// Map backend status to friendly merchant view status
const statusMap = {
  pending: "pending",
  accepted_by_restaurant: "accepted_by_restaurant",
  rejected_by_restaurant: "rejected_by_restaurant",
  preparing: "preparing",
  ready: "ready",
  picked_up: "completed",
  on_the_way: "completed",
  delivered: "completed",
  cancelled_by_customer: "cancelled_by_customer",
};

exports.getMerchantOrders = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { storeId, startDate, endDate } = req.query;

    // 1️⃣ Find all stores belonging to the merchant
    const stores = await Restaurant.find({ ownerId }).select("_id name").lean();
    const storeIds = stores.map(store => store._id);

    if (!storeIds.length) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No stores found",
      });
    }

    // 2️⃣ Base query — store filter
    const query = {};
    if (storeId && storeId !== "all") {
      if (!storeIds.some(id => id.toString() === storeId.toString())) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized store access",
        });
      }
      query.restaurantId = storeId;
    } else {
      query.restaurantId = { $in: storeIds };
    }

    // 3️⃣ Optional date filter
    if (startDate || endDate) {
      query.orderTime = {};
      if (startDate) {
        query.orderTime.$gte = new Date(startDate);
      }
      if (endDate) {
        // include full day by setting end of the day time
        query.orderTime.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
      }
    }

    // 4️⃣ Fetch permissions per restaurant
    const permissions = await Permission.find({ restaurantId: { $in: storeIds } })
      .select("restaurantId permissions")
      .lean();

    const permissionMap = {};
    permissions.forEach(p => {
      permissionMap[p.restaurantId.toString()] = p.permissions;
    });

    // 5️⃣ Fetch orders with relationships
    const orders = await Order.find(query)
      .populate({
        path: "customerId",
        select: "name deliveryAddress guestName guestPhone guestEmail",
      })
      .populate({
        path: "restaurantId",
        select: "name",
      })
      .populate({
        path: "assignedAgent",
        select: "fullName phoneNumber",
      })
      .lean();

    // 6️⃣ Format the response
    const formattedOrders = orders.map(order => {
      const customer = order.customerId || {};
      const restaurant = order.restaurantId || {};
      const agent = order.assignedAgent || null;
      const restaurantPermissions = permissionMap[restaurant._id?.toString()] || {};

      // Only show permissions if order is pending
      let permissionFlags;
      if (order.orderStatus === "pending") {
        permissionFlags = {
          canAcceptOrder: restaurantPermissions.canAcceptOrder || false,
          canRejectOrder: restaurantPermissions.canRejectOrder || false,
        };
      }

      const friendlyStatus = statusMap[order.orderStatus] || order.orderStatus;

      const orderResponse = {
        orderId: order._id,
        orderStatus: friendlyStatus,
        storeName: restaurant.name || "",
        customerName: customer.name || customer.guestName || "",
        customerAddress: order.deliveryAddress
          ? `${order.deliveryAddress.street || ""}${order.deliveryAddress.area ? ", " + order.deliveryAddress.area : ""}, ${order.deliveryAddress.city || ""}, ${order.deliveryAddress.state || ""}, ${order.deliveryAddress.pincode || ""}, ${order.deliveryAddress.country || ""}`
          : "",
        orderItemCount: order.orderItems.length,
        orderItems: order.orderItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        subtotal: order.totalAmount || order.subtotal || 0,
        assignedAgent: agent ? { fullName: agent.fullName, phoneNumber: agent.phoneNumber } : null,
        orderTime: order.orderTime,
        cookingInstructions: order.instructions || "",
      };

      if (permissionFlags) {
        orderResponse.permissions = permissionFlags;
      }

      return orderResponse;
    });

    // 7️⃣ Send response
    res.status(200).json({
      success: true,
      data: formattedOrders,
      message: "Orders fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching merchant orders:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};



exports.updateOrderStatus = async (req, res) => {
  try {
    const ownerId = req.user._id; // merchant/owner from JWT
    const { orderId, status, cancellationReason } = req.body; 
    const io = req.app.get("io"); 

    if (!orderId || !status) {
      return res.status(400).json({ success: false, message: "Order ID and status are required" });
    }

    // Fetch the order
    const order = await Order.findById(orderId)
      .populate("restaurantId")
      .populate("customerId");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Check ownership
    if (!order.restaurantId || order.restaurantId.ownerId.toString() !== ownerId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized to update this order" });
    }

    // Get restaurant permissions
    const restaurantPermissions = await Permission.findOne({ restaurantId: order.restaurantId._id });
    if (!restaurantPermissions) {
      return res.status(403).json({ success: false, message: "No permissions configured for this restaurant" });
    }

    const previousStatus = order.orderStatus;

    // Handle rejection
    if (status === "rejected_by_restaurant") {
      if (!restaurantPermissions.permissions.canRejectOrder) {
        return res.status(403).json({ success: false, message: "You do not have permission to reject orders" });
      }

      order.orderStatus = "rejected_by_restaurant";
      order.cancellationReason = cancellationReason || "Rejected by merchant";

      // Handle refund
      if (order.paymentStatus === "completed" && order.paymentMethod === "online") {
        order.paymentStatus = "pending_refund";
      }
    } 
    // Handle acceptance
    else if (status === "accepted_by_restaurant") {
      if (!restaurantPermissions.permissions.canAcceptOrder) {
        return res.status(403).json({ success: false, message: "You do not have permission to accept orders" });
      }
      order.orderStatus = "accepted_by_restaurant";
    }
    // Other normal statuses (after accepted)
    else {
      const validStatuses = ["preparing", "ready", "delivered"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid order status" });
      }

      order.orderStatus = status;
    }

    await order.save();

    // ===============================
    // Socket Notifications
    // ===============================
    if (io) {
      const customerRoom = `user_${order.customerId._id.toString()}`;
      const adminRoom = `admin_group`;

      io.to(customerRoom).emit("order_status_update", {
        orderId: order._id,
        newStatus: order.orderStatus,
        previousStatus,
        cancellationReason: order.cancellationReason || null,
        timestamp: new Date(),
      });

      io.to(adminRoom).emit("order_status_update_admin", {
        orderId: order._id,
        newStatus: order.orderStatus,
        previousStatus,
        merchantId: ownerId,
        cancellationReason: order.cancellationReason || null,
        timestamp: new Date(),
      });

      if (["delivered", "rejected_by_restaurant"].includes(order.orderStatus)) {
        io.to(customerRoom).emit("order_finalized", {
          orderId: order._id,
          finalStatus: order.orderStatus,
          timestamp: new Date(),
        });
        io.to(adminRoom).emit("order_finalized_admin", {
          orderId: order._id,
          finalStatus: order.orderStatus,
          merchantId: ownerId,
          timestamp: new Date(),
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Order status updated to ${order.orderStatus}`,
      data: {
        orderId: order._id,
        orderStatus: order.orderStatus,
        cancellationReason: order.cancellationReason || null,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.saveFcmToken = async (req, res) => {
  try {
    const userId = req.user._id;
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ message: "fcmToken is required." });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (!user.deviceTokens.includes(fcmToken)) {
      user.deviceTokens.push(fcmToken);
      await user.save();
    }

    res.status(200).json({ success: true, message: "FCM token saved successfully." });
  } catch (err) {
    console.error("Save FCM token error:", err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};





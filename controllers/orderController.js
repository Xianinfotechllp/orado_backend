const mongoose = require("mongoose");
const Order = require("../models/orderModel");
// Create Orderconst Product = require("../models/FoodItem"); // Your product model
const Product = require("../models/productModel");

const { uploadOnCloudinary } = require("../utils/cloudinary");
const { haversineDistance } = require("../utils/distanceCalculator");
const {deliveryFeeCalculator} = require("../utils/deliveryFeeCalculator")
const fs = require("fs");

const firebaseAdmin = require("../config/firebaseAdmin");
const Restaurant = require("../models/restaurantModel");
const { sendPushNotification } = require("../utils/sendPushNotification");
const {
  awardDeliveryPoints,
  awardPointsToRestaurant,
} = require("../utils/awardPoints");

exports.createOrder = async (req, res) => {
  try {
    const { customerId, restaurantId, orderItems, paymentMethod, location } =
      req.body;

    if (
      !restaurantId ||
      !orderItems ||
      !Array.isArray(orderItems) ||
      orderItems.length === 0
    ) {
      return res
        .status(400)
        .json({ error: "restaurantId and orderItems are required" });
    }

    // Validate location
    if (
      !location ||
      !Array.isArray(location.coordinates) ||
      location.coordinates.length !== 2
    ) {
      return res.status(400).json({
        error:
          "Valid location coordinates are required in [longitude, latitude] format",
      });
    }

    const [longitude, latitude] = location.coordinates;
    if (typeof longitude !== "number" || typeof latitude !== "number") {
      return res.status(400).json({
        error: "Coordinates must be numbers in [longitude, latitude] format",
      });
    }

    // ✅ Check if restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    // Extract product IDs from order items
    const productIds = orderItems.map((item) => item.productId);

    // Fetch active products matching those IDs and restaurant
    const products = await Product.find({
      _id: { $in: productIds },
      restaurantId,
      active: true,
    });

    const foundIds = products.map((p) => p._id.toString());
    const missingIds = productIds.filter((id) => !foundIds.includes(id));

    if (missingIds.length > 0) {
      const missingItems = orderItems.filter((item) =>
        missingIds.includes(item.productId)
      );
      const missingNames = missingItems.map(
        (item) => item.name || "Unknown Product"
      );
      return res.status(400).json({
        error: "Some ordered items are invalid or unavailable",
        missingProducts: missingNames,
      });
    }

    // Calculate total amount dynamically
    let totalAmount = 0;
    const now = new Date();

    for (const item of orderItems) {
      const product = products.find((p) => p._id.toString() === item.productId);
      let price = product.price;

      if (
        product.specialOffer &&
        product.specialOffer.discount > 0 &&
        product.specialOffer.startDate <= now &&
        now <= product.specialOffer.endDate
      ) {
        const discountAmount = (price * product.specialOffer.discount) / 100;
        price -= discountAmount;
      }

      totalAmount += price * (item.quantity || 1);
    }

    const io = req.app.get("io");

    const orderData = {
      restaurantId,
      orderItems,
      totalAmount,
      paymentMethod,
      paymentStatus: "pending",
      customerId: customerId || null,
      location: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
    };

    const newOrder = new Order(orderData);
    const savedOrder = await newOrder.save();
    // ✅ Send push notification if restaurant has device token

    await sendPushNotification(
      restaurantId,
      "new order placed",
      "an new order placed by cusotmer"
    );

    // ✅ send realtime notification via Socket.IO
    io.to(restaurantId).emit("new-order", {
      orderId: savedOrder._id,
      totalAmount: savedOrder.totalAmount,
      orderItems: savedOrder.orderItems,
    });

    return res.status(201).json({
      message: "Order created successfully",
      order: savedOrder,
    });
  } catch (err) {
    console.error("createOrder error:", err);
    return res
      .status(500)
      .json({ error: "Failed to create order", details: err.message });
  }
};

// Get Order by ID
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate(
      "customerId restaurantId orderItems.productId"
    );

    if (!order) return res.status(404).json({ error: "Order not found" });

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: "Error fetching order" });
  }
};

// Get Orders by Customer
exports.getOrdersByCustomer = async (req, res) => {
  try {
    const orders = await Order.find({ customerId: req.params.customerId });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

// Get Orders by Agent
exports.getOrdersByAgent = async (req, res) => {
  try {
    const orders = await Order.find({ assignedAgent: req.params.agentId });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

// Update Order Status
// exports.updateOrderStatus = async (req, res) => {
//   const { status } = req.body;
//   const validStatuses = [
//     "pending", "preparing", "ready", "on_the_way", "delivered", "cancelled"
//   ];

//   if (!validStatuses.includes(status)) {
//     return res.status(400).json({ error: "Invalid status value" });
//   }

//   try {
//     const updated = await Order.findByIdAndUpdate(
//       req.params.orderId,
//       { orderStatus: status },
//       { new: true }
//     );
//     if (!updated) return res.status(404).json({ error: "Order not found" });
//     res.json(updated);
//   } catch (err) {
//     res.status(500).json({ error: "Failed to update status" });
//   }
// };

// Cancel Order
exports.cancelOrder = async (req, res) => {
  const { reason, debtCancellation } = req.body;
  try {
    const updated = await Order.findByIdAndUpdate(
      req.params.orderId,
      {
        orderStatus: "cancelled",
        cancellationReason: reason || "",
        debtCancellation: debtCancellation || false,
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Order not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to cancel order" });
  }
};

// Review Order
exports.reviewOrder = async (req, res) => {
  const { customerReview, restaurantReview } = req.body;

  try {
    const customerImageFiles = req.files["customerImages"] || [];
    const restaurantImageFiles = req.files["restaurantImages"] || [];

    // Upload customer images to Cloudinary
    const customerImages = [];
    for (const file of customerImageFiles) {
      const result = await uploadOnCloudinary(file.path);
      if (result?.secure_url) customerImages.push(result.secure_url);
    }

    // Upload restaurant images to Cloudinary
    const restaurantImages = [];
    for (const file of restaurantImageFiles) {
      const result = await uploadOnCloudinary(file.path);
      if (result?.secure_url) restaurantImages.push(result.secure_url);
    }

    // Update the order document
    const updated = await Order.findByIdAndUpdate(
      req.params.orderId,
      {
        customerReview: customerReview || "",
        restaurantReview: restaurantReview || "",
        $push: {
          customerReviewImages: { $each: customerImages },
          restaurantReviewImages: { $each: restaurantImages },
        },
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: "Order not found" });

    res.json(updated);
  } catch (err) {
    console.error("Review submission failed:", err);
    res.status(500).json({ error: "Failed to submit review" });
  }
};

// Update Delivery Mode
exports.updateDeliveryMode = async (req, res) => {
  const { mode } = req.body;
  const validModes = ["contact", "no_contact", "do_not_disturb"];

  if (!validModes.includes(mode)) {
    return res.status(400).json({ error: "Invalid delivery mode" });
  }

  try {
    const updated = await Order.findByIdAndUpdate(
      req.params.orderId,
      { deliveryMode: mode },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update delivery mode" });
  }
};

// Assign Agent
exports.assignAgent = async (req, res) => {
  const { agentId } = req.body;

  if (!agentId) {
    return res.status(400).json({ error: "agentId is required" });
  }

  try {
    const updated = await Order.findByIdAndUpdate(
      req.params.orderId,
      { assignedAgent: agentId },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to assign agent" });
  }
};

// Get All Orders (Admin)
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().populate("customerId restaurantId");
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

// Update Scheduled Time
exports.updateScheduledTime = async (req, res) => {
  const { scheduledTime } = req.body;
  if (!scheduledTime) {
    return res.status(400).json({ error: "scheduledTime is required" });
  }

  try {
    const updated = await Order.findByIdAndUpdate(
      req.params.orderId,
      { scheduledTime },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update scheduled time" });
  }
};

// Update Instructions
exports.updateInstructions = async (req, res) => {
  const { instructions } = req.body;

  try {
    const updated = await Order.findByIdAndUpdate(
      req.params.orderId,
      { instructions },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update instructions" });
  }
};

// Apply Discount
exports.applyDiscount = async (req, res) => {
  const { discountAmount, couponCode } = req.body;

  try {
    const updated = await Order.findByIdAndUpdate(
      req.params.orderId,
      { discountAmount, couponCode },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to apply discount" });
  }
};

// Get Customer Order Status
exports.getCustomerOrderStatus = async (req, res) => {
  try {
    const customerId = req.params.customerId;

    const orders = await Order.find({ customerId })
      .select("orderStatus _id scheduledTime restaurantId")
      .populate("restaurantId", "name");

    res.json(orders);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Server error while fetching order status" });
  }
};

// Get Guest Orders (Admin)
exports.getGuestOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customerId: null });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch guest orders" });
  }
};

// Get Scheduled Orders (Admin or Restaurant Dashboard)
exports.getScheduledOrders = async (req, res) => {
  try {
    const now = new Date();
    const orders = await Order.find({
      scheduledTime: { $gte: now },
      orderStatus: "pending",
    }).populate("customerId restaurantId");

    res.json(orders);
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch scheduled orders",
      details: err.message,
    });
  }
};

// Get Customer Scheduled Orders
exports.getCustomerScheduledOrders = async (req, res) => {
  try {
    const customerId = req.params.customerId;
    const now = new Date();

    const orders = await Order.find({
      customerId,
      scheduledTime: { $gte: now },
      orderStatus: "pending",
    }).sort({ scheduledTime: 1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch customer scheduled orders",
      details: err.message,
    });
  }
};

exports.merchantAcceptOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Validate orderId format
    if (!orderId || orderId.length !== 24) {
      return res.status(400).json({ error: "Invalid order ID format" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (order.orderStatus === "cancelled") {
      return res.status(400).json({ error: "Cannot accept a cancelled order" });
    }
    // Prevent double accepting or invalid status transitions
    if (order.orderStatus === "accepted") {
      return res.status(400).json({ error: "Order is already accepted" });
    }

    // Update status to 'accepted'
    order.orderStatus = "accepted";
    await order.save();

    // Emit to  user  via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to(order.customerId.toString()).emit("order-accepted", {
        message: "Order status chhanged",
        order,
      });
    }

    res.status(200).json({
      success: true,
      message: "Order accepted successfully",
      order,
    });
  } catch (error) {
    console.error("merchantAcceptOrder error:", error);
    res.status(500).json({
      error: "Failed to accept order",
      details: error.message,
    });
  }
};

exports.merchantRejectOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { rejectionReason } = req.body;

    // Validate orderId format
    if (!orderId || orderId.length !== 24) {
      return res.status(400).json({ error: "Invalid order ID format" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Prevent rejecting completed or already cancelled orders
    if (order.orderStatus === "completed") {
      return res.status(400).json({ error: "Cannot reject a completed order" });
    }

    if (order.orderStatus === "cancelled") {
      return res.status(400).json({ error: "Order is already cancelled" });
    }

    // Update order status to 'cancelled'
    order.orderStatus = "cancelled";
    order.rejectionReason = rejectionReason || "Rejected by merchant";
    await order.save();

    // Emit event via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to(order.restaurantId.toString()).emit("order-rejected", {
        orderId: order._id,
        message: "Order has been rejected by the merchant",
        reason: order.rejectionReason,
      });
    }

    res.status(200).json({
      success: true,
      message: "Order rejected successfully",
      order,
    });
  } catch (error) {
    console.error("merchantRejectOrder error:", error);
    res.status(500).json({
      error: "Failed to reject order",
      details: error.message,
    });
  }
};

// Update Order Status (Merchant) agent
exports.updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { newStatus } = req.body;

  const merchantAllowedStatuses = [
    "accepted_by_restaurant",
    "rejected_by_restaurant",
    "preparing",
    "ready",
  ];

  // Optionally allow 'completed' for the system or other roles
  const allowedStatuses = [...merchantAllowedStatuses, "completed"];

  if (!allowedStatuses.includes(newStatus)) {
    return res.status(400).json({
      error: `Invalid status. Allowed statuses: ${allowedStatuses.join(", ")}`,
    });
  }

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    order.orderStatus = newStatus;
    await order.save();

    // Award points only when status is 'completed'
    if (newStatus === "completed") {
      // Award delivery points to agent
      if (order.agentId) {
        try {
          await awardDeliveryPoints(order.agentId, 10); // 10 points per delivery
        } catch (err) {
          console.error("Failed to award delivery points:", err);
        }
      }

      // Award milestone points to restaurant
      if (order.restaurantId) {
        // Example: award 10 points every 5 completed orders
        const completedOrdersCount = await Order.countDocuments({
          restaurantId: order.restaurantId,
          orderStatus: "completed",
        });

        if (completedOrdersCount % 5 === 0) {
          try {
            await awardPointsToRestaurant(
              order.restaurantId,
              10,
              "Milestone: 5 deliveries",
              order._id
            );
          } catch (err) {
            console.error("Failed to award restaurant points:", err);
          }
        }
      }
    }

    res.status(200).json({
      message: "Order status updated successfully",
      order,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getOrdersByMerchant = async (req, res) => {
  try {
    const { restaurantId } = req.query;

    if (!restaurantId) {
      return res.status(400).json({ error: "restaurantId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ error: "Invalid restaurantId format" });
    }

    const orders = await Order.find({ restaurantId })
      .populate("customerId", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Orders fetched successfully",
      totalOrders: orders.length,
      orders,
    });
  } catch (err) {
    console.error("getOrdersByMerchant error:", err);
    return res
      .status(500)
      .json({ error: "Failed to fetch orders", details: err.message });
  }
};

// Sample coupons object — replace with DB lookup later
const coupons = {
  SAVE10: { type: "percentage", value: 10 },
  FLAT50: { type: "flat", value: 50 },
};

const TAX_PERCENTAGE = 8; // example 8%

exports.getOrderPriceSummary = async (req, res) => {
  try {
    const {
      restaurantId,
      cart,
      deliveryAddress,
      coupon: couponCode,
    } = req.body;

    if (!restaurantId || !cart || !deliveryAddress) {
      return res.status(400).json({
        error: "restaurantId, cart, and deliveryAddress are required",
      });
    }

    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: "Cart must be a non-empty array" });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    // Subtotal calculation
    let subtotal = 0;
    for (const item of cart) {
      if (!item.price || !item.quantity) {
        return res.status(400).json({
          error: "Each cart item must have price and quantity",
        });
      }
      subtotal += item.price * item.quantity;
    }

    // Distance calculation
    const restaurantCoords = restaurant.location.coordinates
    const userCoords = deliveryAddress.coordinates

    const distanceKm = haversineDistance(restaurantCoords, userCoords);

    // Delivery Fee
    const deliveryFee = deliveryFeeCalculator({
      distanceKm,
      orderAmount: subtotal,
    });

    // Coupon Discount
    let discount = 0;
    if (couponCode) {
      const coupon = coupons[couponCode.toUpperCase()];
      if (!coupon) {
        return res.status(400).json({ error: "Invalid coupon code" });
      }
      if (coupon.type === "percentage") {
        discount = (subtotal * coupon.value) / 100;
      } else if (coupon.type === "flat") {
        discount = coupon.value;
      }
    }

    // Tax calculation
    const taxableAmount = Math.max(subtotal - discount, 0);
    const tax = (taxableAmount * TAX_PERCENTAGE) / 100;

    // Final total
    const total = taxableAmount + tax + deliveryFee;

    // Final response
    return res.status(200).json({
      message: "Order price summary calculated successfully",
      billSummary: {
        subtotal: subtotal.toFixed(2),
        discount: discount.toFixed(2),
        tax: tax.toFixed(2),
        deliveryFee: deliveryFee.toFixed(2),
        total: total.toFixed(2),
     
      },
    });
  } catch (error) {
    console.error("Error calculating order price summary:", error);
    return res.status(500).json({
      error: "Server error while calculating order price summary",
    });
  }
};

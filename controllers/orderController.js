const mongoose = require("mongoose");
const Order = require("../models/orderModel");
// Create Orderconst Product = require("../models/FoodItem"); // Your product model
const Cart = require("../models/cartModel");
const Product = require("../models/productModel");
const { calculateOrderCost } = require("../services/orderCostCalculator");
const { uploadOnCloudinary } = require("../utils/cloudinary");
const { haversineDistance } = require("../utils/distanceCalculator");
const { deliveryFeeCalculator } = require("../utils/deliveryFeeCalculator");
const fs = require("fs");

const firebaseAdmin = require("../config/firebaseAdmin");
const {
  findAndAssignNearestAgent,
} = require("../services/findAndAssignNearestAgent");
const Permission = require("../models/restaurantPermissionModel");

const Restaurant = require("../models/restaurantModel");
const { sendPushNotification } = require("../utils/sendPushNotification");
const {NotificationPreference} = require("../models/notificationModel");
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
     // Clear cart after order placed
    await Cart.findOneAndUpdate(
      { userId: userId },
      { products: [], totalPrice: 0 }
    );

    //  Check permission for auto-accept
    const permission = await Permission.findOne({ restaurantId });
    const canAccept = permission?.permissions?.canAcceptOrder ?? false;
    if (!canAccept) {
      // Auto-accept order
      savedOrder.orderStatus = "accepted_by_restaurant";
      savedOrder.autoAccepted = true;
      await savedOrder.save();

      // Notify customer
      if (io) {
        io.to(`user_${customerId?.toString()}`).emit("order-accepted", {
          message: "Order auto-accepted",
          order: savedOrder,
        });
      }
    }
    // ✅ Send push notification if restaurant has device token

    await sendPushNotification(
      restaurantId,
      "new order placed",
      "an new order placed by cusotmer"
    );

    //  send realtime notification via Socket.IO
    io.to(`restaurant_${restaurantId}`).emit("new-order", {
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

exports.placeOrder = async (req, res) => {
  try {
    const {
      longitude,
      latitude,
      cartId,
      userId,
      paymentMethod,
      couponCode,
      instructions,
      tipAmount = 0,
      street,
      area,
      landmark,
      city,
      state,
      pincode,
      country = "India",
    } = req.body;

    if (
      !cartId ||
      !userId ||
      !paymentMethod ||
      !longitude ||
      !latitude ||
      !street ||
      !city ||
      !pincode
    ) {
      return res.status(400).json({ error: "Required fields are missing" });
    }

    // Find cart
    const cart = await Cart.findOne({ _id: cartId, user: userId });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    // Find restaurant
    const restaurant = await Restaurant.findById(cart.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const userCoords = [parseFloat(longitude), parseFloat(latitude)];

    // Calculate bill summary
    const billSummary = calculateOrderCost({
      cartProducts: cart.products,
      restaurant,
      userCoords,
      couponCode,
    });

    const orderItems = await Promise.all(
      cart.products.map(async (item) => {
        const product = await Product.findById(item.productId).select('images');

        return {
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          name: item.name,
          totalPrice: item.price * item.quantity,
          image: product?.images?.[0] || 'https://example.com/default-image.jpg',
        };
      })
    );



    // Create new order
    const newOrder = new Order({
      customerId: userId,
      restaurantId: cart.restaurantId,
      orderItems,
      paymentMethod,
      orderStatus: "pending",
      deliveryLocation: { type: "Point", coordinates: userCoords },
      deliveryAddress: {
        street,
        area,
        landmark,
        city,
        state,
        pincode,
        country,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      },
      subtotal: billSummary.subtotal,
      tax: billSummary.tax,
      discountAmount: billSummary.discount,
      deliveryCharge: billSummary.deliveryFee,
      surgeCharge: 0,
      tipAmount,
      totalAmount: billSummary.total + tipAmount,
      distanceKm: billSummary.distanceKm,
      couponCode,
      instructions,
    });

    const savedOrder = await newOrder.save();

    const io = req.app.get("io");

    // Notify restaurant or assign agent based on restaurant permission
    if (restaurant.permissions.canAcceptRejectOrders) {

      console.log("Notify restaurant for order acceptance");

      io.to(`restaurant_${restaurant._id.toString()}`).emit("newOrder", {
        orderId: savedOrder._id,
      });


      return res.status(201).json({
        message: "Order placed successfully",
        orderId: savedOrder._id,
        totalAmount: savedOrder.totalAmount,
        billSummary,
        orderStatus: "pending_restaurant_acceptance"
      });

    } else {
      // Auto-assign nearest agent
      const assignedAgent = await findAndAssignNearestAgent(savedOrder._id, {
        longitude,
        latitude,
      });


      if (assignedAgent) {
        const updateData = {
          assignedAgent: assignedAgent._id,
        };

        if (assignedAgent.permissions.canAcceptOrRejectOrders) {
          updateData.orderStatus = "pending_agent_acceptance";

          console.log("Order sent to agent for acceptance:", assignedAgent.fullName);

          await sendPushNotification(
            assignedAgent.userId,
            "New Delivery Request",
            "You have a new delivery request. Please accept it."
          );

        } else {
          updateData.orderStatus = "assigned_to_agent";

          console.log("Order auto-assigned to:", assignedAgent.fullName);

          // Start live tracking
          io.to(`agent_${assignedAgent._id.toString()}`).emit("startDeliveryTracking", {
            orderId: savedOrder._id,
            customerId: savedOrder.customerId,
            restaurantId: savedOrder.restaurantId,
          });

          // Notify customer and restaurant
          io.to(`user_${savedOrder.customerId.toString()}`).emit("agentAssigned", {
            agentId: assignedAgent._id,
            orderId: savedOrder._id,
          });

          io.to(`restaurant_${savedOrder.restaurantId.toString()}`).emit("agentAssigned", {
            agentId: assignedAgent._id,
            orderId: savedOrder._id,
          });

          // Send push notifications
          await sendPushNotification(
            savedOrder.customerId,
            "Agent Assigned",
            "Your order is on the way."
          );

          await sendPushNotification(
            savedOrder.restaurantId,
            "Agent Assigned",
            "An agent has been assigned to deliver the order."
          );
        }

        // Update order with agent assignment status
        await Order.findByIdAndUpdate(savedOrder._id, updateData);

    if (assignedAgent) {
      const updateData = {
        assignedAgent: assignedAgent._id,
      };

      if (assignedAgent.permissions.canAcceptOrRejectOrders) {
        updateData.orderStatus = "pending_agent_acceptance";


      } else {

        // No available agent found
        console.log("No available agent found for auto-assignment.");
        await Order.findByIdAndUpdate(savedOrder._id, {
          orderStatus: "awaiting_agent_assignment",

        updateData.orderStatus = "assigned_to_agent";

        // Emit socket event to start live tracking immediately
        const io = req.app.get("io");
        io.to(`agent_${assignedAgent._id.toString()}`).emit("startDeliveryTracking", {
          orderId: savedOrder._id,
          customerId: savedOrder.customerId,
          restaurantId: savedOrder.restaurantId,
        });

        // Notify customer and restaurant (optional)
        io.to(`user_${savedOrder.customerId.toString()}`).emit("agentAssigned", {
          agentId: assignedAgent._id,
          orderId: savedOrder._id,

        });
      }





      await Order.findByIdAndUpdate(savedOrder._id, updateData);
    }
 else {
      await Order.findByIdAndUpdate(savedOrder._id, {
        orderStatus: "awaiting_agent_assignment"
      });

    }

    // Optional: Clear cart after order placed
    await Cart.findByIdAndDelete(cartId);

    // Final response
    return res.status(201).json({
      message: "Order placed successfully",
      orderId: savedOrder._id,
      totalAmount: savedOrder.totalAmount,
      billSummary,
      orderStatus: savedOrder.orderStatus,
    });


  } catch (err) {

    console.error("Error placing order:", err);
    res.status(500).json({ error: "Failed to place order" });
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
    const customerId = req.user._id;
    const orders = await Order.find({ customerId })
                  .populate("restaurantId", "name location address")
                  .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

// Get Orders by Agent
exports.getOrdersByAgent = async (req, res) => {
  try {
  const orders = await Order.find(
  { assignedAgent: req.params.agentId },
  "status totalAmount location" // <-- only these fields from Order itself
)
  .populate({
    path: "restaurantId",
    select: "name location address"
  })
  .populate({
    path: "customerId",
    select: "name phone"
  })
  .sort({ createdAt: -1 });
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
        orderStatus: "cancelled_by_customer",
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

    // Validate restaurant for this merchant
    const restaurant = await Restaurant.findOne({ ownerId: req.user._id });
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // Validate orderId format
    if (!orderId || orderId.length !== 24) {
      return res.status(400).json({ error: "Invalid order ID format" });
    }

    // Fetch order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Validate order status
    if (order.orderStatus === "cancelled_by_customer") {
      return res.status(400).json({ error: "Cannot accept a cancelled order" });
    }

    if (order.orderStatus === "accepted_by_restaurant") {
      return res.status(400).json({ error: "Order is already accepted" });
    }

    // ✅ Update status to 'accepted_by_restaurant'
    order.orderStatus = "accepted_by_restaurant";
    await order.save();

    // ✅ Emit to customer via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${order.customerId.toString()}`).emit("order-accepted", {
        message: "Your order has been accepted by the restaurant",
        order,
      });
    }

    // ✅ Respond to merchant
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
    if (order.orderStatus === "ready") {
      return res.status(400).json({ error: "Cannot reject a completed order" });
    }

    if (order.orderStatus === "cancelled_by_customer") {
      return res.status(400).json({ error: "Order is already cancelled" });
    }

    // Update order status to 'cancelled'
    order.orderStatus = "rejected_by_restaurant";
    order.rejectionReason = rejectionReason || "Rejected by merchant";
    await order.save();

    // Emit event via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${order.restaurantId.toString()}`).emit("order-rejected", {
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
    const { restaurantId } = req.params;

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
    const { longitude, latitude, couponCode, cartId, userId } = req.body;

    if (!cartId || !userId) {
      return res.status(400).json({ error: "cartId and userId are required" });
    }

    const cart = await Cart.findOne({ _id: cartId, user:userId });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found for this user" });
    }

    if (!cart.products || cart.products.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    const restaurant = await Restaurant.findById(cart.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const userCoords = [parseFloat(longitude), parseFloat(latitude)];

    // Optional: Validate userCoords are valid numbers here

    const costSummary = calculateOrderCost({
      cartProducts: cart.products,
      restaurant,
      userCoords,
      couponCode,
    });

    return res.status(200).json({
      message: "Bill summary calculated successfully",
      data: costSummary,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }

};

exports.reassignExpiredOrders = async () => {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
    const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000);

    // 1. Reassign orders stuck in 'pending_agent_acceptance'
    const pendingOrders = await Order.find({
      orderStatus: "pending_agent_acceptance",
      $or: [
        { "agentRespondedAt": { $exists: false } },
        { "agentRespondedAt": { $lte: fiveMinutesAgo } }
      ]
    }).populate("assignedAgent", "permissions.maxCODAmount codTracking.currentCODHolding");

    for (const order of pendingOrders) {
      // Release the original agent
      if (order.assignedAgent) {
        await Agent.findByIdAndUpdate(order.assignedAgent._id, {
          $inc: { "deliveryStatus.currentOrderCount": -1 },
          "deliveryStatus.status": "Available"
        });
      }

      // Reset order status
      await Order.findByIdAndUpdate(order._id, {
        assignedAgent: null,
        orderStatus: "awaiting_agent_assignment",
        $push: { 
          reassignmentHistory: { 
            timestamp: new Date(),
            reason: "agent_acceptance_timeout" 
          } 
        }
      });

      // Reassign with COD check (using updated findAndAssignNearestAgent)
      await findAndAssignNearestAgent(
        order._id,
        {
          longitude: order.location.coordinates[0],
          latitude: order.location.coordinates[1]
        }
      );
    }

    // 2. Handle orders stuck in 'awaiting_agent_assignment'
    const unassignedOrders = await Order.find({
      orderStatus: "awaiting_agent_assignment",
      createdAt: { $lte: thirtyMinutesAgo }
    });

    if (unassignedOrders.length > 0) {
      
      // Option 1: Expand search radius gradually
      for (const order of unassignedOrders) {
        await findAndAssignNearestAgent(
          order._id,
          {
            longitude: order.location.coordinates[0],
            latitude: order.location.coordinates[1]
          },
          10000 // 10km instead of default 5km
        );
      }

      // Option 2: Notify admin
      await notifyAdmin({
        title: "Unassigned Order Alert",
        message: `${unassignedOrders.length} orders need manual assignment.`,
        urgency: "high"
      });
    }

    return {
      reassigned: pendingOrders.length,
      longPending: unassignedOrders.length
    };
  } catch (error) {
    console.error("[reassignExpiredOrders] Failed:", error);
    throw error;
  }

};

// Reorder previous order

exports.reorder = async (req, res) => {
  try {
    const userId = req.user._id; 
    
    const { orderId } = req.params;

    const previousOrder = await Order.findById(orderId);
    if (!previousOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (previousOrder.customerId.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Unauthorized access to this order' });
    }

    // Clean up any existing cart
    await Cart.findOneAndDelete({ userId });

    const products = [];

    for (const item of previousOrder.orderItems) {
      const product = await Product.findById(item.productId);
      if (!product || !product.active) continue; // skip deleted/inactive products

      const currentPrice = product.price;
      const quantity = item.quantity;

      products.push({
        productId: product._id,
        name: product.name,
        price: currentPrice,
        quantity,
        total: currentPrice * quantity,
      });
    }

    if (products.length === 0) {
      return res.status(400).json({ message: 'No products from the original order are available.' });
    }

    const totalPrice = products.reduce((sum, p) => sum + p.total, 0);

    const newCart = new Cart({
      userId,
      restaurantId: previousOrder.restaurantId,
      products,
      totalPrice,
    });

    await sendPushNotification(
      userId,
      `ReOrder Placed with with order id ${orderId}`,
      `Here are the products ${products}`,
      'orderUpdates'
    );

    await newCart.save();

    res.status(200).json({ message: 'Cart created from previous order.', cart: newCart });
  } catch (error) {
    console.error('Error in reorder:', error);
    res.status(500).json({ message: 'Something went wrong while reordering.' });
  }
};
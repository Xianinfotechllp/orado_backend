const Order = require("../models/orderModel");

// Create Order
exports.createOrder = async (req, res) => {
  try {
    const {
      customerId,
      restaurantId,
      orderItems,
      totalAmount,
      deliveryCharge,
      tipAmount,
      paymentMethod,
      location,
      scheduledTime,
      instructions,
      surgeCharge,
      discountAmount,
      couponCode,
      guestName,
      guestPhone,
      guestEmail,
    } = req.body;

    if (!restaurantId || !Array.isArray(orderItems) || orderItems.length === 0) {
      return res.status(400).json({ error: 'restaurantId and orderItems are required' });
    }

    // If it's a guest order, require guest contact info
    if (!customerId) {
      if (!guestName || !guestPhone) {
        return res.status(400).json({ error: 'Guest name and phone are required for guest checkout' });
      }
    }

    const orderData = {
      restaurantId,
      orderItems,
      totalAmount,
      deliveryCharge,
      tipAmount,
      paymentMethod,
      paymentStatus: "pending",
      location,
      scheduledTime,
      instructions,
      surgeCharge,
      discountAmount,
      couponCode,
    };

    if (customerId) {
      orderData.customerId = customerId;
    } else {
      orderData.guestName = guestName;
      orderData.guestPhone = guestPhone;
      orderData.guestEmail = guestEmail;
    }

    const order = new Order(orderData);
    const savedOrder = await order.save();
    res.status(201).json(savedOrder);
  } catch (err) {
    res.status(500).json({ error: "Failed to create order", details: err.message });
  }
};

// Get Order by ID
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate("customerId restaurantId orderItems.productId");

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
    const updated = await Order.findByIdAndUpdate(
      req.params.orderId,
      {
        customerReview: customerReview || "",
        restaurantReview: restaurantReview || "",
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Order not found" });
    res.json(updated);
  } catch (err) {
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
    res.status(500).json({ message: "Server error while fetching order status" });
  }
};

// Get Guest Orders (Admin)
exports.getGuestOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customerId: null });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch guest orders' });
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

// Update Order Status (Merchant)
exports.updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { newStatus } = req.body;

  const merchantAllowedStatuses = [
    'accepted_by_restaurant',
    'rejected_by_restaurant',
    'preparing',
    'ready'
  ];

  if (!merchantAllowedStatuses.includes(newStatus)) {
    return res.status(400).json({
      error: `Invalid status. Merchants can only update status to: ${merchantAllowedStatuses.join(', ')}`
    });
  }

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    order.orderStatus = newStatus;
    await order.save();


    res.status(200).json({
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


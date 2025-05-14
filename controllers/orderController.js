const Order=require("../models/orderModel");

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
      couponCode
    } = req.body;

    if (!customerId || !restaurantId || !orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
      return res.status(400).json({ error: 'Required fields missing or invalid: customerId, restaurantId, orderItems' });
    }

    const order = new Order({
      customerId,
      restaurantId,
      orderItems,
      totalAmount,
      deliveryCharge,
      tipAmount,
      paymentMethod,
      paymentStatus: 'pending',
      location,
      scheduledTime,
      instructions,
      surgeCharge,
      discountAmount,
      couponCode
    });

    const savedOrder = await order.save();
    res.status(201).json(savedOrder);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create order', details: err.message });
  }
};

//  Get Order by ID 
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('customerId restaurantId orderItems.productId');

    if (!order) return res.status(404).json({ error: 'Order not found' });

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching order' });
  }
};

// Get Orders by Customer
exports.getOrdersByCustomer = async (req, res) => {
  try {
    const orders = await Order.find({ customerId: req.params.customerId });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

//Get Orders by Agent 
exports.getOrdersByAgent = async (req, res) => {
  try {
    const orders = await Order.find({ agentId: req.params.agentId });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

//Update Order Status
exports.updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'preparing', 'ready', 'on_the_way', 'delivered', 'cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    const updated = await Order.findByIdAndUpdate(
      req.params.orderId,
      { orderStatus: status },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Order not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
};

// cancelOrder
exports.cancelOrder = async (req, res) => {
  const { reason, debtCancellation } = req.body;
  try {
    const updated = await Order.findByIdAndUpdate(
      req.params.orderId,
      {
        orderStatus: 'cancelled',
        cancellationReason: reason || '',
        debtCancellation: debtCancellation || false
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Order not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel order' });
  }
};

// reviewOrder
exports.reviewOrder = async (req, res) => {
  const { customerReview, restaurantReview } = req.body;
  try {
    const updated = await Order.findByIdAndUpdate(
      req.params.orderId,
      {
        customerReview: customerReview || '',
        restaurantReview: restaurantReview || ''
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Order not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit review' });
  }
};

//updateDeliveryMode
exports.updateDeliveryMode = async (req, res) => {
  const { mode } = req.body;
  const validModes = ['contact', 'no_contact', 'do_not_disturb'];

  if (!validModes.includes(mode)) {
    return res.status(400).json({ error: 'Invalid delivery mode' });
  }

  try {
    const updated = await Order.findByIdAndUpdate(
      req.params.orderId,
      { deliveryMode: mode },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update delivery mode' });
  }
};


//assign-Agent
exports.assignAgent = async (req, res) => {
  const { agentId } = req.body;

  if (!agentId) {
    return res.status(400).json({ error: 'agentId is required' });
  }

  try {
    const updated = await Order.findByIdAndUpdate(
      req.params.orderId,
      { agentId },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign agent' });
  }
};

//getAllOrders-Admin
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().populate('customerId restaurantId');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

//updateScheduledTime
exports.updateScheduledTime = async (req, res) => {
  const { scheduledTime } = req.body;
  if (!scheduledTime) {
    return res.status(400).json({ error: 'scheduledTime is required' });
  }

  try {
    const updated = await Order.findByIdAndUpdate(
      req.params.orderId,
      { scheduledTime },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update scheduled time' });
  }
};

//updateInstructions
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
    res.status(500).json({ error: 'Failed to update instructions' });
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
    res.status(500).json({ error: 'Failed to apply discount' });
  }
};

// getCustomerOrderStatus

exports.getCustomerOrderStatus = async (req, res) => {
  try {
    const customerId = req.params.customerId;

    const orders = await Order.find({ customerId })
      .select('orderStatus _id scheduledTime restaurantId')
      .populate('restaurantId', 'name'); // optional: populate restaurant name

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching order status' });
  }
};
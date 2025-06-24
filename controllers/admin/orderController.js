const Order = require("../../models/orderModel")
exports.getActiveOrdersStats = async (req, res) => {
  try {
    // Get current date and date from one week ago
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Count current active orders (not delivered or cancelled)
    const currentActiveCount = await Order.countDocuments({
      status: { 
        $nin: ['delivered', 'cancelled'] 
      }
    });

    // Count active orders from one week ago
    const previousActiveCount = await Order.countDocuments({
      status: { 
        $nin: ['delivered', 'cancelled'] 
      },
      createdAt: { $lt: oneWeekAgo }
    });

    // Calculate percentage change
    let percentageChange = 0;
    let trend = '→'; // neutral
    if (previousActiveCount > 0) {
      percentageChange = ((currentActiveCount - previousActiveCount) / previousActiveCount) * 100;
      trend = percentageChange > 0 ? '↑' : '↓';
    }

    res.status(200).json({
      activeOrders: currentActiveCount,
      percentageChange: Math.abs(percentageChange).toFixed(1),
      trend,
      message: "Active orders stats fetched successfully",
      messageType: "success",
      statusCode: 200
    });

  } catch (error) {
    console.error("Error fetching active orders stats:", error);
    res.status(500).json({ 
      message: "Server error while fetching active orders stats", 
      messageType: "error", 
      statusCode: 500 
    });
  }
};


exports.getSimpleRectOrderStats = async (req, res) => {
  try {
    // Get last 4 orders (or adjust limit as needed)
    const orders = await Order.find()
      .sort({ orderTime: -1 }) // Newest first
      .limit(4)
      .populate('restaurantId', 'name') // Only get restaurant name
      .lean();
    
    // Format to match your exact requirements
    const formattedOrders = orders.map(order => ({
      id: order._id.toString().substring(18, 22), // Short ID like 1001
      restaurant: order.restaurantId?.name || 'Unknown',
      amount: order.totalAmount,
      status: order.orderStatus === 'delivered' ? 'Completed' : 'Pending'
    }));
    
    res.json(formattedOrders);
    
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json([]); // Return empty array on error
  }
};













exports.getAdminOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate({ path: 'customerId', select: 'name' })
      .populate({ path: 'restaurantId', select: 'name' })
      .sort({ createdAt: -1 })
      .lean();

    const formattedOrders = orders.map(order => ({
      orderId: order._id,
      orderStatus: order.orderStatus,
      restaurantName: order.restaurantId?.name || 'N/A',
      customerName: order.customerId?.name || 'Guest',
      amount: `$ ${order.totalAmount.toFixed(2)}`,
      address: `${order.deliveryAddress.street}, ${order.deliveryAddress.city}, ${order.deliveryAddress.state}`,
      deliveryMode: order.deliveryMode,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod === 'cash' ? 'Pay On Delivery' : order.paymentMethod,
      preparationTime: `${order.preparationTime || 0} Mins`,
      orderTime: new Date(order.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
      scheduledDeliveryTime: new Date(order.orderTime).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
    }));

    res.status(200).json({
      messageType: "success",
      message: "Orders fetched successfully.",
      data: formattedOrders
    });
  } catch (error) {
    console.error("Error fetching admin orders:", error);
    res.status(500).json({
      messageType: "failure",
      message: "Something went wrong."
    });
  }
};

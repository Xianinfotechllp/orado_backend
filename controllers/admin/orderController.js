const Order = require("../../models/orderModel")
const Agent = require("../../models/agentModel")
const Restaurant = require("../../models/restaurantModel")
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



exports.getAllOrderLocationsForMap = async (req, res) => {
  try {
    const orders = await Order.find({
      deliveryLocation: { $exists: true },
      'deliveryLocation.coordinates': { $ne: null },
      orderStatus: { $in: ['in_progress', 'on_the_way', 'picked_up', 'delivered', "accepted_by_restaurant"] } // optional: filter live deliveries
    }).populate("restaurantId" , "name location address").populate("customerId" , "name phone").select('_id orderStatus deliveryLocation');

    const formattedOrders = orders.map(order => ({
      id: order._id,
      orderId: order._id.toString().slice(-6).toUpperCase(),  // OR use your existing order number if you have a field
      lng: order.deliveryLocation.coordinates[0],
      lat: order.deliveryLocation.coordinates[1],
      status: order.orderStatus,
      restaurant:order.restaurantId,
      customer:order.customerId
      
    }));

    res.status(200).json({
      messageType: 'success',
      data: formattedOrders
    });

  } catch (error) {
    console.error("Error fetching order locations:", error);
    res.status(500).json({
      messageType: 'failure',
      message: 'Failed to fetch delivery order locations'
    });
  }
};



exports.getAgentOrderDispatchStatuses = async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate("customerId", "name phone email")
      .populate("restaurantId", "name")
      .populate("assignedAgent", "fullName phoneNumber agentStatus")  // populate agentStatus too
      .sort({ createdAt: -1 });

    const formattedOrders = orders.map(order => ({
      orderId: order._id,
      orderTime: order.createdAt,
      orderStatus: order.orderStatus,
      agentAssignmentStatus: order.agentAssignmentStatus || "Unassigned",
      assignedAgent: order.assignedAgent ? order.assignedAgent.fullName : "Unassigned",
      agentPhone: order.assignedAgent ? order.assignedAgent.phoneNumber : "-",
      agentCurrentStatus: order.assignedAgent?.agentStatus?.currentStatus || "OFFLINE",
      agentAvailability: order.assignedAgent?.agentStatus?.availability || "Unavailable",
      restaurantName: order.restaurantId ? order.restaurantId.name : "-",
      customerName: order.customerId ? order.customerId.name : "-",
      customerPhone: order.customerId ? order.customerId.phone : "-",
      deliveryLocation: order.deliveryLocation?.coordinates || [],
      deliveryAddress: order.deliveryAddress?.street || "-",
      totalAmount: order.totalAmount || 0,
    }));

    res.status(200).json({
      messageType: "success",
      data: formattedOrders,
    });
  } catch (error) {
    console.error("Error fetching dispatch statuses:", error);
    res.status(500).json({
      messageType: "failure",
      message: "Failed to fetch agent dispatch statuses",
    });
  }
};

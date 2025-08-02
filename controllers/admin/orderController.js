const Order = require("../../models/orderModel")
const Agent = require("../../models/agentModel")
const Restaurant = require("../../models/restaurantModel")

const notificationService = require("../../services/notificationService"); // Import the notification service

const mongoose = require("mongoose")
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
      .populate({ path: 'restaurantId', select: 'name address location' })
      .sort({ createdAt: -1 })
      .lean();

 const formattedOrders = orders.map(order => ({
  orderId: order._id,
  restaurantId: order.restaurantId?._id || null, // add this line
  orderStatus: order.orderStatus,
  restaurantName: order.restaurantId?.name || 'N/A',
  restaurantAddress: order.restaurantId?.address || 'N/A',
  restaurantLocation: order.restaurantId?.location,
  customerName: order.customerId?.name || 'Guest',
  customerId: order.customerId?._id || null,
  amount: `$ ${order.totalAmount?.toFixed(2)}`,
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
      .populate("restaurantId", "name address location")
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
       restaurantAddress:order.restaurantId ? order.restaurantId.address : "",
       restaurantLocation: order.restaurantId ? order.restaurantId.location : null,
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










// @desc    Update order status
// @route   PATCH /api/admin/orders/:orderId/status
// @access  Admin only (add auth middleware if needed)

exports.updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  const io = req.app.get("io"); // Get socket.io instance

  const allowedStatuses = [
    'pending', 'accepted_by_restaurant', 'rejected_by_restaurant',
    'preparing', 'ready', 'assigned_to_agent', 'picked_up', 'on_the_way',
    'in_progress', 'arrived', 'completed', 'delivered', 'cancelled_by_customer'
  ];

  try {
    // Validate orderId
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    // Validate status
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    // Find and update order
    const order = await Order.findById(orderId)
      .populate("customerId", "_id devices") // Include devices for FCM tokens
      .populate("restaurantId", "_id")
      .populate("assignedAgent", "_id");

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const previousStatus = order.orderStatus;
    order.orderStatus = status;
    await order.save();

    // Emit socket events to notify relevant parties
    if (io) {
      // Always notify the customer
      io.to(`user_${order.customerId._id.toString()}`).emit(
        "order_status_update",
        {
          orderId: order._id,
          newStatus: status,
          previousStatus,
          timestamp: new Date(),
        }
      );

      // Flutter app notification
      io.to(`user_${order.customerId._id.toString()}`).emit(
        "order_status_update_flutter",
        {
          orderId: order._id,
          newStatus: status,
          previousStatus,
          timestamp: new Date(),
        }
      );

      // Special handling for completed/delivered status
      if (status === "completed" || status === "delivered") {
        io.to(`user_${order.customerId._id.toString()}`).emit(
          "order_completed",
          {
            orderId: order._id,
            timestamp: new Date(),
          }
        );

        // Also emit order_delivered event for the frontend to handle
        if (status === "delivered") {
          io.to(`user_${order.customerId._id.toString()}`).emit(
            "order_delivered",
            {
              orderId: order._id,
              timestamp: new Date(),
            }
          );
        }
      }

      // Notify restaurant for relevant status changes
      if (["preparing", "ready", "rejected_by_restaurant", "completed", "delivered"].includes(status)) {
        io.to(`restaurant_${order.restaurantId._id.toString()}`).emit(
          "order_status_update",
          {
            orderId: order._id,
            newStatus: status,
            previousStatus,
            timestamp: new Date(),
          }
        );
      }

      // Notify delivery agent for relevant status changes
      if (order.assignedAgent && ["assigned_to_agent", "picked_up", "on_the_way", "in_progress", "arrived", "completed", "delivered"].includes(status)) {
        io.to(`agent_${order.assignedAgent._id.toString()}`).emit(
          "order_status_update",
          {
            orderId: order._id,
            newStatus: status,
            previousStatus,
            timestamp: new Date(),
          }
        );

        // Special event when order is ready for pickup
        if (status === "ready") {
          io.to(`agent_${order.assignedAgent._id.toString()}`).emit(
            "order_ready_for_pickup",
            {
              orderId: order._id,
              restaurantId: order.restaurantId._id,
              customerId: order.customerId._id,
              timestamp: new Date(),
            }
          );
        }
      }
    }

    // Send FCM notification to the customer
    try {
      await notificationService.sendOrderNotification({
        userId: order.customerId._id,
        title: `Order Status Updated`,
        body: `Your order #${order._id.toString().slice(-6)} is now ${status}.`,
        orderId: order._id.toString(),
        data: {
          orderStatus: status,
          previousStatus: previousStatus,
        },
        deepLinkUrl: `/orders/${order._id}`,
      });
    } catch (notificationError) {
      console.error("Failed to send FCM notification:", notificationError.message);
    }

    return res.status(200).json({
      message: 'Order status updated successfully',
      updatedStatus: order.orderStatus,
      orderId: order._id
    });
  } catch (err) {
    console.error('Error updating order status:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
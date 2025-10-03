const Order = require("../../models/orderModel")
const Agent = require("../../models/agentModel")
const Restaurant = require("../../models/restaurantModel")
const moment = require('moment')
const notificationService = require("../../services/notificationService"); // Import the notification service
const { calculateRestaurantEarnings, createRestaurantEarning } = require("../../services/earningService");
const mongoose = require("mongoose")


const AllocationSettings = require("../../models/AllocationSettingsModel");
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
    // Parse pagination parameters with defaults
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const totalOrders = await Order.countDocuments();

    // Fetch orders with pagination
    const orders = await Order.find()
      .populate({ path: 'customerId', select: 'name' })
      .populate({ path: 'restaurantId', select: 'name address location' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const formattedOrders = orders.map(order => ({
      orderId: order._id,
      restaurantId: order.restaurantId?._id || null,
      orderStatus: order.orderStatus,
      restaurantName: order.restaurantId?.name || 'N/A',
      restaurantAddress: order.restaurantId?.address || 'N/A',
      restaurantLocation: order.restaurantId?.location,
      customerName: order.customerId?.name || 'Guest',
      customerId: order.customerId?._id || null,
      amount: `₹ ${order.totalAmount?.toFixed(2)}`,
      address: `${order.deliveryAddress.street}, ${order.deliveryAddress.city}, ${order.deliveryAddress.state}`,
      deliveryMode: order.deliveryMode,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod === 'cash' ? 'Pay On Delivery' : order.paymentMethod,
      preparationTime: `${order.preparationTime || 0} Mins`,
      orderTime: new Date(order.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
      scheduledDeliveryTime: new Date(order.orderTime).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalOrders / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      messageType: "success",
      message: "Orders fetched successfully.",
      data: formattedOrders,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalOrders: totalOrders,
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage,
        limit: limit
      }
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



  const earningsInfo = await calculateRestaurantEarnings({
  restaurantId: order.restaurantId._id,
  storeType: order.restaurantId.storeType || "restaurant", // assuming this field exists
  orderAmounts:{subtotal:order.subtotal,tax:order.tax,finalAmount:order.totalAmount },
  orderItems:order.orderItems
});

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
       earningsInfo ,


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
    // Filter for new orders (pending or awaiting agent assignment)
    const query = {
      orderStatus: { 
        $in: ['pending', 'pending_agent_acceptance', 'awaiting_agent_assignment'] 
      }
    };

    const orders = await Order.find(query)
      .populate("customerId", "name phone email")
      .populate("restaurantId", "name address location")
      .populate("assignedAgent", "fullName phoneNumber agentStatus")
      .sort({ createdAt: -1 })

    const formattedOrders = orders.map(order => {
      // Derive agentAssignmentStatus
      let agentAssignmentStatus = "Unassigned";

      if (order.assignedAgent) {
        agentAssignmentStatus = "Assigned";
      } else if (order.agentCandidates?.length > 0) {
        const hasAccepted = order.agentCandidates.some(c => c.status === 'accepted');
        const allRejectedOrTimedOut = order.agentCandidates.every(c =>
          ['rejected', 'timed_out'].includes(c.status)
        );
        const hasPending = order.agentCandidates.some(c => c.status === 'pending');

        if (hasAccepted) {
          agentAssignmentStatus = "Accepted";
        } else if (hasPending) {
          agentAssignmentStatus = "Pending";
        } else if (allRejectedOrTimedOut) {
          agentAssignmentStatus = "Rejected";
        } else {
          agentAssignmentStatus = "In Progress";
        }
      }

      return {
        orderId: order._id,
        orderTime: order.createdAt,
        orderStatus: order.orderStatus,
        agentAssignmentStatus,
        assignedAgent: order.assignedAgent ? order.assignedAgent.fullName : "Unassigned",
        agentPhone: order.assignedAgent ? order.assignedAgent.phoneNumber : "-",
        agentCurrentStatus: order.assignedAgent?.agentStatus?.currentStatus || "OFFLINE",
        agentAvailability: order.assignedAgent?.agentStatus?.availability || "Unavailable",
        restaurantName: order.restaurantId?.name || "-",
        restaurantAddress: order.restaurantId?.address || "",
        restaurantLocation: order.restaurantId?.location || null,
        customerName: order.customerId?.name || "-",
        customerPhone: order.customerId?.phone || "-",
        deliveryLocation: order.deliveryLocation?.coordinates || [],
        deliveryAddress: order.deliveryAddress?.street || "-",
        totalAmount: order.totalAmount || 0,
      };
    });

    res.status(200).json({
      messageType: "success",
      data: formattedOrders,
      count: formattedOrders.length,
      newOrdersCount: formattedOrders.filter(o => 
        o.orderStatus === 'pending' || 
        o.orderStatus === 'awaiting_agent_assignment'
      ).length
    });
  } catch (error) {
    console.error("Error fetching dispatch statuses:", error);
    res.status(500).json({
      messageType: "failure",
      message: "Failed to fetch agent dispatch statuses",
      error: error.message
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

           try {
    await createRestaurantEarning(order);
  } catch (earningErr) {
    console.error("❌ Failed to create restaurant earning:", earningErr.message);
    // Optional: log this somewhere or send an alert to admin
  }


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












exports.getOrderLocationsByPeriod = async (req, res) => {
  try {
    const { period, from, to } = req.query;
    let startDate, endDate;

    // Determine date range based on period param
    switch (period) {
      case "today":
        startDate = moment().startOf("day").toDate();
        endDate = moment().endOf("day").toDate();
        break;
      case "this_week":
        startDate = moment().startOf("isoWeek").toDate();
        endDate = moment().endOf("isoWeek").toDate();
        break;
      case "this_month":
        startDate = moment().startOf("month").toDate();
        endDate = moment().endOf("month").toDate();
        break;
      case "custom":
        if (!from || !to) {
          return res.status(400).json({ message: "Custom range requires 'from' and 'to' dates." });
        }
        startDate = new Date(from);
        endDate = new Date(to);
        break;
      default:
        return res.status(400).json({ message: "Invalid period specified." });
    }

    // Fetch allocation settings once
    const allocationSettings = await AllocationSettings.findOne({});
    if (!allocationSettings) {
      console.warn("⚠️ AllocationSettings not found, using default expiry");
    }

    // Fetch orders with necessary fields and populate references
    const orders = await Order.find({
      orderTime: { $gte: startDate, $lte: endDate },
      "deliveryLocation.coordinates": { $exists: true, $ne: [] },
    })
      .select(`
        deliveryLocation deliveryAddress restaurantId orderItems
        assignedAgent agentAssignmentStatus orderStatus orderTime grandTotal
        paymentMethod paymentStatus allocationMethod agentCandidates
      `)
      .populate("restaurantId", "location name")
      .populate("assignedAgent", "fullName phoneNumber profilePicture")
      .populate("agentCandidates.agent", "fullName phoneNumber profilePicture")
      .lean();

    // Map orders to response format with allocation progress and expiresIn
    const mapped = orders.map(order => {
      const [lng, lat] = order.deliveryLocation?.coordinates || [];

      // Determine request expiry seconds based on allocation method config
      let expirySec = 120; // fallback 2 minutes
      switch (order.allocationMethod) {
        case "one_by_one":
          expirySec = allocationSettings?.oneByOneSettings?.requestExpirySec || expirySec;
          break;
        case "send_to_all":
          expirySec = allocationSettings?.sendToAllSettings?.requestExpirySec || expirySec;
          break;
        case "fifo":
          expirySec = allocationSettings?.fifoSettings?.requestTimeSec || expirySec;
          break;
        // Add more allocation methods here if needed
        default:
          expirySec = 120;
      }

      // Build agent candidates summary
      const candidateSummary = {
        total: order.agentCandidates?.length || 0,
        notified: 0,
        pending: 0,
        accepted: 0,
        rejected: 0,
        timed_out: 0,
        currentCandidate: null,
        candidates: [],
      };

  if (order.agentCandidates?.length) {
  order.agentCandidates.forEach(c => {
    candidateSummary[c.status] = (candidateSummary[c.status] || 0) + 1;

    if (c.isCurrentCandidate) {
      // Calculate how many seconds left before expiry
      let expiresIn = null;
      if (c.notifiedAt) {
        const notifiedAtMs = new Date(c.notifiedAt).getTime();
        const nowMs = Date.now();
        const elapsedMs = nowMs - notifiedAtMs;
        const remainingMs = expirySec * 1000 - elapsedMs;
        expiresIn = remainingMs > 0 ? Math.floor(remainingMs / 1000) : 0;
      }

      candidateSummary.currentCandidate = {
        agentId: c.agent._id,
        fullName: c.agent.fullName,
        status: c.status,
        notifiedAt: c.notifiedAt,
        assignedAt: c.assignedAt,
        expiresIn, // seconds left to respond
        totalTime: expirySec // Add this line to include the total time
      };
    }

    candidateSummary.candidates.push({
      agentId: c.agent._id,
      fullName: c.agent.fullName,
      status: c.status,
      assignedAt: c.assignedAt,
      notifiedAt: c.notifiedAt,
      respondedAt: c.respondedAt,
      rejectionReason: c.rejectionReason || null,
      isCurrentCandidate: c.isCurrentCandidate,
    });
  });
}

      return {
        _id: order._id,
        dropLocation: {
          coordinates: { lat, lng },
          address: order.deliveryAddress || null,
        },
        pickupLocation:
          order.restaurantId?.location?.coordinates?.length === 2
            ? {
                lat: order.restaurantId.location.coordinates[1],
                lng: order.restaurantId.location.coordinates[0],
              }
            : null,
        restaurantName: order.restaurantId?.name || null,
        assignedAgent: order.assignedAgent || null,
        agentAssignmentStatus: order.agentAssignmentStatus,
        orderStatus: order.orderStatus,
        orderTime: order.orderTime,
        totalAmount: order.grandTotal,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        allocationMethod: order.allocationMethod,
        allocationProgress: candidateSummary,
        items: order.orderItems,
      };
    });

    return res.status(200).json({
      messageType: "success",
      period,
      count: mapped.length,
      data: mapped,
    });
  } catch (error) {
    console.error("❌ Error fetching order locations:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};



exports.getDeliveryHeatmap = async (req, res) => {
  try {
    const { status, from, to } = req.query;

    const matchQuery = {};

    if (status) matchQuery.orderStatus = status;
    if (from || to) matchQuery.orderTime = {};
    if (from) matchQuery.orderTime.$gte = new Date(from);
    if (to) matchQuery.orderTime.$lte = new Date(to);

    // Aggregate orders by coordinates
    const aggregated = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            lat: { $round: [{ $arrayElemAt: ["$deliveryLocation.coordinates", 1] }, 5] },
            lng: { $round: [{ $arrayElemAt: ["$deliveryLocation.coordinates", 0] }, 5] }
          },
          orderCount: { $sum: 1 },
          totalAmount: { $sum: "$grandTotal" }
        }
      },
      {
        $project: {
          _id: 0,
          type: "Feature",
          geometry: { type: "Point", coordinates: ["$_id.lng", "$_id.lat"] },
          properties: {
            orderCount: "$orderCount",
            totalAmount: "$totalAmount"
          }
        }
      }
    ]);

    res.json({ type: "FeatureCollection", features: aggregated });
  } catch (err) {
    console.error("Error fetching heatmap orders:", err);
    res.status(500).json({ message: "Server error" });
  }
};


exports.getTopMerchantsByRevenue = async (req, res) => {
  try {
    const period = req.query.period || 'monthly'; // daily, weekly, monthly, yearly
    const limit = parseInt(req.query.limit) || 5;

    let startDate = new Date();
    let endDate = new Date();

    // ------------------ Set date range ------------------
    if (period === 'daily') {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'weekly') {
      const day = startDate.getDay(); // Sunday=0
      startDate.setDate(startDate.getDate() - day); // first day of week
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'monthly') {
      startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'yearly') {
      startDate = new Date(startDate.getFullYear(), 0, 1);
      endDate = new Date(startDate.getFullYear(), 11, 31, 23, 59, 59, 999);
    }

    // ------------------ Aggregate by Restaurant ------------------
    const topMerchants = await Order.aggregate([
      {
        $match: {
          orderStatus: 'delivered', // only delivered orders
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$restaurantId',
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { totalRevenue: -1 } }, // highest revenue first
      { $limit: limit },
      {
        $lookup: {
          from: 'restaurants',
          localField: '_id',
          foreignField: '_id',
          as: 'restaurant'
        }
      },
      { $unwind: '$restaurant' },
      {
        $project: {
          _id: 0,
          restaurantId: '$restaurant._id',
          name: '$restaurant.name',
          totalOrders: 1,
          totalRevenue: 1
        }
      }
    ]);

    res.status(200).json({ success: true, period, startDate, endDate, data: topMerchants });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error fetching top merchants', error: error.message });
  }
};




exports.getPlatformSalesGraphData = async (req, res) => {
  try {
    const { period, startDate, endDate, groupBy = 'day' } = req.query;

    let dateFilter = {};
    let groupFormat = {};
    let dateFormat = '';
    let start, end;

    // Set date range based on period or custom dates
    if (period === 'today') {
      start = new Date();
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 1);
      
      dateFilter = {
        orderTime: {
          $gte: start,
          $lt: end
        }
      };
      groupFormat = { 
        year: { $year: '$orderTime' },
        month: { $month: '$orderTime' },
        day: { $dayOfMonth: '$orderTime' },
        hour: { $hour: '$orderTime' }
      };
      dateFormat = 'hour';

    } else if (period === 'week') {
      // Get current week (Monday to Sunday)
      start = getStartOfWeek(new Date());
      end = new Date(start);
      end.setDate(end.getDate() + 7);
      
      dateFilter = {
        orderTime: {
          $gte: start,
          $lt: end
        }
      };
      groupFormat = { 
        year: { $year: '$orderTime' },
        month: { $month: '$orderTime' },
        day: { $dayOfMonth: '$orderTime' }
      };
      dateFormat = 'day';

    } else if (period === 'month') {
      // Get current month
      start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      
      dateFilter = {
        orderTime: {
          $gte: start,
          $lt: end
        }
      };
      groupFormat = { 
        year: { $year: '$orderTime' },
        month: { $month: '$orderTime' },
        day: { $dayOfMonth: '$orderTime' }
      };
      dateFormat = 'day';

    } else if (period === 'year') {
      // Get current year
      start = new Date(new Date().getFullYear(), 0, 1);
      end = new Date(new Date().getFullYear() + 1, 0, 1);
      
      dateFilter = {
        orderTime: {
          $gte: start,
          $lt: end
        }
      };
      groupFormat = { 
        year: { $year: '$orderTime' },
        month: { $month: '$orderTime' }
      };
      dateFormat = 'month';

    } else if (startDate && endDate) {
      // Custom date range
      start = new Date(startDate);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      dateFilter = {
        orderTime: {
          $gte: start,
          $lte: end
        }
      };

      // Determine grouping based on date range difference
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 1) {
        groupFormat = { 
          year: { $year: '$orderTime' },
          month: { $month: '$orderTime' },
          day: { $dayOfMonth: '$orderTime' },
          hour: { $hour: '$orderTime' }
        };
        dateFormat = 'hour';
      } else if (diffDays <= 31) {
        groupFormat = { 
          year: { $year: '$orderTime' },
          month: { $month: '$orderTime' },
          day: { $dayOfMonth: '$orderTime' }
        };
        dateFormat = 'day';
      } else if (diffDays <= 365) {
        groupFormat = { 
          year: { $year: '$orderTime' },
          month: { $month: '$orderTime' }
        };
        dateFormat = 'month';
      } else {
        groupFormat = { 
          year: { $year: '$orderTime' },
          month: { $month: '$orderTime' }
        };
        dateFormat = 'month';
      }
    } else {
      // Default: last 7 days
      start = new Date();
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
      
      dateFilter = {
        orderTime: {
          $gte: start,
          $lte: end
        }
      };
      groupFormat = { 
        year: { $year: '$orderTime' },
        month: { $month: '$orderTime' },
        day: { $dayOfMonth: '$orderTime' }
      };
      dateFormat = 'day';
    }

    // Add status filter to only include completed/delivered orders
    dateFilter.orderStatus = { 
      $in: ['completed', 'delivered', 'accepted_by_restaurant', 'preparing', 'ready', 'delivered'] 
    };

    const analytics = await Order.aggregate([
      {
        $match: dateFilter
      },
      {
        $group: {
          _id: groupFormat,
          totalAmount: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
          averageOrderValue: { $avg: '$totalAmount' },
          date: { $first: '$orderTime' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 }
      },
      {
        $project: {
          _id: 0,
          date: {
            $dateToString: {
              format: getDateFormat(dateFormat),
              date: '$date'
            }
          },
          totalAmount: { $round: ['$totalAmount', 2] },
          orderCount: 1,
          averageOrderValue: { $round: ['$averageOrderValue', 2] },
          period: dateFormat
        }
      }
    ]);

    // Fill missing dates with zero values
    const filledAnalytics = fillMissingDates(analytics, start, end, dateFormat);

    // Calculate summary statistics
    const summary = await Order.aggregate([
      {
        $match: dateFilter
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: '$totalAmount' },
          maxOrderValue: { $max: '$totalAmount' },
          minOrderValue: { $min: '$totalAmount' }
        }
      }
    ]);

    const summaryData = summary.length > 0 ? summary[0] : {
      totalRevenue: 0,
      totalOrders: 0,
      avgOrderValue: 0,
      maxOrderValue: 0,
      minOrderValue: 0
    };

    res.json({
      success: true,
      data: {
        analytics: filledAnalytics,
        summary: {
          totalRevenue: Math.round(summaryData.totalRevenue || 0),
          totalOrders: summaryData.totalOrders || 0,
          averageOrderValue: Math.round(summaryData.avgOrderValue || 0),
          maxOrderValue: Math.round(summaryData.maxOrderValue || 0),
          minOrderValue: Math.round(summaryData.minOrderValue || 0)
        },
        period: dateFormat,
        dateRange: {
          start: start,
          end: end
        }
      }
    });

  } catch (error) {
    console.error('Error fetching order analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order analytics',
      error: error.message
    });
  }
};

// Helper function to fill missing dates with zero values
function fillMissingDates(analytics, startDate, endDate, period) {
  const filledData = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  // Create a map of existing data for quick lookup
  const existingDataMap = {};
  analytics.forEach(item => {
    existingDataMap[item.date] = item;
  });

  // Generate all dates in the range
  while (current <= end) {
    const dateString = formatDateByPeriod(current, period);
    
    if (existingDataMap[dateString]) {
      // Use existing data
      filledData.push(existingDataMap[dateString]);
    } else {
      // Create zero-value entry for missing date
      filledData.push({
        date: dateString,
        totalAmount: 0,
        orderCount: 0,
        averageOrderValue: 0,
        period: period
      });
    }

    // Move to next period
    if (period === 'hour') {
      current.setHours(current.getHours() + 1);
    } else if (period === 'day') {
      current.setDate(current.getDate() + 1);
    } else if (period === 'month') {
      current.setMonth(current.getMonth() + 1);
    }
  }

  return filledData;
}

// Helper function to format date based on period
function formatDateByPeriod(date, period) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');

  switch (period) {
    case 'hour':
      return `${year}-${month}-${day} ${hour}:00`;
    case 'day':
      return `${year}-${month}-${day}`;
    case 'month':
      return `${year}-${month}`;
    default:
      return `${year}-${month}-${day}`;
  }
}

// Helper function to get start of week (Monday)
function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper function to determine date format for grouping
function getDateFormat(period) {
  switch (period) {
    case 'hour':
      return '%Y-%m-%d %H:00';
    case 'day':
      return '%Y-%m-%d';
    case 'month':
      return '%Y-%m';
    case 'year':
      return '%Y';
    default:
      return '%Y-%m-%d';
  }
}






function formatHour(h) {
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour12}${ampm}`;
}

exports.getPeakHoursGraph = async (req, res) => {
  try {
    const period = req.query.period || 'daily'; // daily, weekly, monthly, yearly
    const today = new Date();

    let startDate, endDate;

    // ------------------ Set date range ------------------
    if (period === 'daily') {
      startDate = new Date(today.setHours(0,0,0,0));
      endDate = new Date(today.setHours(23,59,59,999));
    } else if (period === 'weekly') {
      const firstDayOfWeek = new Date(today);
      firstDayOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
      firstDayOfWeek.setHours(0,0,0,0);
      startDate = firstDayOfWeek;

      const lastDayOfWeek = new Date(firstDayOfWeek);
      lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
      lastDayOfWeek.setHours(23,59,59,999);
      endDate = lastDayOfWeek;
    } else if (period === 'monthly') {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'yearly') {
      startDate = new Date(today.getFullYear(), 0, 1);
      endDate = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
    }

    // ------------------ Aggregate orders ------------------
    let groupId = {};
    if (period === 'daily') groupId = { hour: { $hour: "$createdAt" } };
    else if (period === 'weekly') groupId = { day: { $dayOfWeek: "$createdAt" }, hour: { $hour: "$createdAt" } };
    else if (period === 'monthly') groupId = { date: { $dayOfMonth: "$createdAt" }, hour: { $hour: "$createdAt" } };
    else if (period === 'yearly') groupId = { month: { $month: "$createdAt" }, hour: { $hour: "$createdAt" } };

    const aggData = await Order.aggregate([
      { $match: { orderStatus: "delivered", createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: {
          _id: groupId,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" }
        }
      },
      { $sort: { "_id.hour": 1 } }
    ]);

    // ------------------ Pre-fill nested data ------------------
    let nestedData = {};

    if (period === 'daily') {
      nestedData['Today'] = Array.from({length:24}, (_, i) => ({ hour: formatHour(i), totalOrders:0, totalRevenue:0 }));
    } else if (period === 'weekly') {
      const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      days.forEach(day => {
        nestedData[day] = Array.from({length:24}, (_, i) => ({ hour: formatHour(i), totalOrders:0, totalRevenue:0 }));
      });
    } else if (period === 'monthly') {
      const daysInMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
      for (let d=1; d<=daysInMonth; d++) {
        nestedData[`Day ${d}`] = Array.from({length:24}, (_, i) => ({ hour: formatHour(i), totalOrders:0, totalRevenue:0 }));
      }
    } else if (period === 'yearly') {
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      months.forEach((m,i) => {
        nestedData[m] = Array.from({length:24}, (_, h) => ({ hour: formatHour(h), totalOrders:0, totalRevenue:0 }));
      });
    }

    // ------------------ Fill aggregation results ------------------
    aggData.forEach(item => {
      let key;
      let hour = item._id.hour;

      if (period === 'daily') key = 'Today';
      else if (period === 'weekly') {
        const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        key = days[item._id.day - 1];
      } else if (period === 'monthly') key = `Day ${item._id.date}`;
      else if (period === 'yearly') {
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        key = months[item._id.month - 1];
      }

      nestedData[key][hour] = { hour: formatHour(hour), totalOrders: item.totalOrders, totalRevenue: item.totalRevenue };
    });

    // ------------------ Calculate peak & weak hours ------------------
    let peakHoursOverall = [];
    let weakHoursOverall = [];
    for (const k in nestedData) {
      const sorted = [...nestedData[k]].sort((a,b) => b.totalOrders - a.totalOrders);
      peakHoursOverall.push({ period:k, peak: sorted.slice(0,3).map(h=>h.hour), weak: sorted.slice(-3).map(h=>h.hour) });
    }

    res.status(200).json({
      success:true,
      period,
      startDate,
      endDate,
      data: nestedData,
      peakHours: peakHoursOverall
    });

  } catch(err) {
    console.error(err);
    res.status(500).json({ success:false, message: err.message });
  }
};



exports.getMostOrderedAreas = async (req, res) => {
  try {
    const { 
      limit = 5, 
      period = 'all',
      startDate, 
      endDate,
      groupBy = 'city',
      lastNDays // Last N days filter
    } = req.query;

    // Build date filter
    let dateFilter = {};
    const now = new Date();

    if (lastNDays && !isNaN(lastNDays)) {
      const nDaysAgo = new Date();
      nDaysAgo.setDate(now.getDate() - parseInt(lastNDays));
      dateFilter = {
        createdAt: {
          $gte: nDaysAgo,
          $lte: now
        }
      };
    } else {
      switch (period) {
        case 'today':
          const todayStart = new Date(now);
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date(now);
          todayEnd.setHours(23, 59, 59, 999);
          dateFilter = {
            createdAt: {
              $gte: todayStart,
              $lte: todayEnd
            }
          };
          break;
        
        case 'yesterday':
          const yesterday = new Date(now);
          yesterday.setDate(now.getDate() - 1);
          const yesterdayStart = new Date(yesterday);
          yesterdayStart.setHours(0, 0, 0, 0);
          const yesterdayEnd = new Date(yesterday);
          yesterdayEnd.setHours(23, 59, 59, 999);
          dateFilter = {
            createdAt: {
              $gte: yesterdayStart,
              $lte: yesterdayEnd
            }
          };
          break;
        
        case 'week':
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0, 0, 0, 0);
          dateFilter = {
            createdAt: {
              $gte: startOfWeek,
              $lte: now
            }
          };
          break;
        
        case 'lastWeek':
          const startOfLastWeek = new Date(now);
          startOfLastWeek.setDate(now.getDate() - now.getDay() - 7);
          startOfLastWeek.setHours(0, 0, 0, 0);
          const endOfLastWeek = new Date(startOfLastWeek);
          endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
          endOfLastWeek.setHours(23, 59, 59, 999);
          dateFilter = {
            createdAt: {
              $gte: startOfLastWeek,
              $lte: endOfLastWeek
            }
          };
          break;
        
        case 'month':
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          dateFilter = {
            createdAt: {
              $gte: startOfMonth,
              $lte: now
            }
          };
          break;
        
        case 'lastMonth':
          const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          dateFilter = {
            createdAt: {
              $gte: startOfLastMonth,
              $lte: endOfLastMonth
            }
          };
          break;
        
        case 'year':
          const startOfYear = new Date(now.getFullYear(), 0, 1);
          dateFilter = {
            createdAt: {
              $gte: startOfYear,
              $lte: now
            }
          };
          break;
        
        case 'custom':
          if (startDate && endDate) {
            dateFilter = {
              createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
              }
            };
          }
          break;
        
        // 'all' - no date filter
      }
    }

    // Build match stage
    const matchStage = {
      orderStatus: { $in: ['completed', 'delivered'] },
      [`deliveryAddress.${groupBy}`]: { $exists: true, $ne: '' }
    };

    // Add date filter if not 'all'
    if (period !== 'all' && Object.keys(dateFilter).length > 0) {
      matchStage.createdAt = dateFilter.createdAt;
    }

    const result = await Order.aggregate([
      {
        $match: matchStage
      },
      // Add additional fields for time-based analysis
      {
        $addFields: {
          orderMonth: { $month: '$createdAt' },
          orderYear: { $year: '$createdAt' },
          orderDayOfWeek: { $dayOfWeek: '$createdAt' }
        }
      },
      // Rest of the aggregation pipeline...
      {
        $group: {
          _id: `$deliveryAddress.${groupBy}`,
          totalOrders: { $sum: 1 },
          orders: { $push: '$$ROOT' }
        }
      },
      {
        $unwind: '$orders'
      },
      {
        $unwind: '$orders.orderItems'
      },
      {
        $group: {
          _id: {
            location: '$_id',
            itemName: '$orders.orderItems.name'
          },
          totalOrders: { $first: '$totalOrders' },
          itemCount: { $sum: '$orders.orderItems.quantity' }
        }
      },
      {
        $sort: { itemCount: -1 }
      },
      {
        $group: {
          _id: '$_id.location',
          totalOrders: { $first: '$totalOrders' },
          popularItem: { $first: '$_id.itemName' },
          popularItemCount: { $first: '$itemCount' }
        }
      },
      {
        $project: {
          _id: 0,
          area: '$_id',
          popular: '$popularItem',
          orders: '$totalOrders',
          popularItemOrders: '$popularItemCount'
        }
      },
      {
        $sort: { orders: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    res.json({
      success: true,
      data: result,
      filters: {
        period: lastNDays ? `last${lastNDays}Days` : period,
        startDate: period === 'custom' ? startDate : undefined,
        endDate: period === 'custom' ? endDate : undefined,
        groupBy,
        limit: parseInt(limit)
      },
      message: `Most ordered ${groupBy}s retrieved successfully`
    });

  } catch (error) {
    console.error('Error fetching popular items by location:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching popular items by location',
      error: error.message
    });
  }
};


// Main controller for order statistics and data
exports.getOrdersSummary = async (req, res) => {
  try {
    const { period = 'today' } = req.query; // today, week, month, year
    
    // Calculate date range based on period with proper UTC handling
    const dateRange = getDateRange(period);
    
    console.log('Date Range:', {
      period,
      currentStart: dateRange.currentStart,
      currentEnd: dateRange.currentEnd,
      previousStart: dateRange.previousStart,
      previousEnd: dateRange.previousEnd
    });

    // Get current period data
    const currentStats = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: dateRange.currentStart,
            $lte: dateRange.currentEnd
          }
        }
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          completedOrders: {
            $sum: {
              $cond: [{ $in: ['$orderStatus', ['delivered', 'completed']] }, 1, 0]
            }
          },
          cancelledOrders: {
            $sum: {
              $cond: [{ $in: ['$orderStatus', ['cancelled_by_customer', 'rejected_by_restaurant', 'rejected_by_agent']] }, 1, 0]
            }
          },
          totalRevenue: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Get previous period data for comparison
    const previousStats = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: dateRange.previousStart,
            $lte: dateRange.previousEnd
          }
        }
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          completedOrders: {
            $sum: {
              $cond: [{ $in: ['$orderStatus', ['delivered', 'completed']] }, 1, 0]
            }
          },
          cancelledOrders: {
            $sum: {
              $cond: [{ $in: ['$orderStatus', ['cancelled_by_customer', 'rejected_by_restaurant', 'rejected_by_agent']] }, 1, 0]
            }
          },
          totalRevenue: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Format the response data
    const currentData = currentStats[0] || {
      totalOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      totalRevenue: 0
    };

    const previousData = previousStats[0] || {
      totalOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      totalRevenue: 0
    };

    // Calculate percentages
    const totalOrdersPercentage = calculatePercentage(currentData.totalOrders, previousData.totalOrders);
    const completedOrdersPercentage = calculatePercentage(currentData.completedOrders, previousData.completedOrders);
    const cancelledOrdersPercentage = calculatePercentage(currentData.cancelledOrders, previousData.cancelledOrders);
    const revenuePercentage = calculatePercentage(currentData.totalRevenue, previousData.totalRevenue);

    // Format revenue with Indian Rupees symbol
    const formattedRevenue = formatIndianRupees(currentData.totalRevenue);

    // Calculate summary metrics safely
    const completionRate = currentData.totalOrders > 0 
      ? ((currentData.completedOrders / currentData.totalOrders) * 100).toFixed(1)
      : '0.0';
    
    const cancellationRate = currentData.totalOrders > 0 
      ? ((currentData.cancelledOrders / currentData.totalOrders) * 100).toFixed(1)
      : '0.0';
    
    const averageOrderValue = currentData.totalOrders > 0 
      ? (currentData.totalRevenue / currentData.totalOrders).toFixed(2)
      : '0.00';

    const responseData = {
      period,
      dateRange: {
        current: {
          start: dateRange.currentStart,
          end: dateRange.currentEnd
        },
        previous: {
          start: dateRange.previousStart,
          end: dateRange.previousEnd
        }
      },
      statistics: {
        totalOrders: {
          value: currentData.totalOrders,
          percentage: totalOrdersPercentage,
          trend: parseFloat(totalOrdersPercentage) >= 0 ? 'up' : 'down',
          label: 'Total Orders'
        },
        completedOrders: {
          value: currentData.completedOrders,
          percentage: completedOrdersPercentage,
          trend: parseFloat(completedOrdersPercentage) >= 0 ? 'up' : 'down',
          label: 'Completed Orders'
        },
        cancelledOrders: {
          value: currentData.cancelledOrders,
          percentage: cancelledOrdersPercentage,
          trend: parseFloat(cancelledOrdersPercentage) >= 0 ? 'up' : 'down',
          label: 'Cancelled Orders'
        },
        totalRevenue: {
          value: formattedRevenue,
          rawValue: currentData.totalRevenue,
          percentage: revenuePercentage,
          trend: parseFloat(revenuePercentage) >= 0 ? 'up' : 'down',
          label: 'Total Revenue'
        }
      },
      summary: {
        completionRate,
        cancellationRate,
        averageOrderValue
      }
    };

    res.json({
      success: true,
      message: 'Order dashboard data fetched successfully',
      data: responseData
    });

  } catch (error) {
    console.error('Error fetching order dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order dashboard data',
      error: error.message
    });
  }
};

// Helper function to calculate date ranges with proper UTC handling
function getDateRange(period) {
  const now = new Date();
  
  // Use UTC methods to avoid timezone issues
  const getUTCDate = (date) => {
    return new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds()
    ));
  };

  let currentStart, currentEnd, previousStart, previousEnd;

  switch (period) {
    case 'today':
      // Today in UTC
      currentStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      currentEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      
      // Yesterday in UTC
      const yesterday = new Date(currentStart);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      previousStart = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 0, 0, 0, 0));
      previousEnd = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 23, 59, 59, 999));
      break;

    case 'week':
      // Current week (Monday to Sunday)
      const currentDay = now.getUTCDay();
      const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay; // Adjust for Sunday
      
      currentStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday, 0, 0, 0, 0));
      currentEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      
      // Previous week
      previousStart = new Date(currentStart);
      previousStart.setUTCDate(previousStart.getUTCDate() - 7);
      previousEnd = new Date(currentStart);
      previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
      previousEnd.setUTCHours(23, 59, 59, 999);
      break;

    case 'month':
      // Current month
      currentStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      currentEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      
      // Previous month
      previousStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
      previousEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999)); // Last day of previous month
      break;

    case 'year':
      // Current year
      currentStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
      currentEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      
      // Previous year
      previousStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1, 0, 0, 0, 0));
      previousEnd = new Date(Date.UTC(now.getUTCFullYear() - 1, 11, 31, 23, 59, 59, 999));
      break;

    default:
      // Default to today
      currentStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      currentEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      
      const defaultYesterday = new Date(currentStart);
      defaultYesterday.setUTCDate(defaultYesterday.getUTCDate() - 1);
      previousStart = new Date(Date.UTC(defaultYesterday.getUTCFullYear(), defaultYesterday.getUTCMonth(), defaultYesterday.getUTCDate(), 0, 0, 0, 0));
      previousEnd = new Date(Date.UTC(defaultYesterday.getUTCFullYear(), defaultYesterday.getUTCMonth(), defaultYesterday.getUTCDate(), 23, 59, 59, 999));
  }

  return {
    currentStart,
    currentEnd,
    previousStart,
    previousEnd
  };
}

// Helper function to calculate percentage change
function calculatePercentage(current, previous) {
  if (previous === 0) {
    return current > 0 ? '100.0' : '0.0';
  }
  const percentage = ((current - previous) / previous * 100);
  return percentage.toFixed(1);
}

// Helper function to format Indian Rupees
function formatIndianRupees(amount) {
  return '₹' + new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0
  }).format(amount);
}
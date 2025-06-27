
const User = require("../../models/userModel")
const Order = require("../../models/orderModel")
exports.getAllCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "" } = req.query;

    // Build search query
    const searchQuery = {
      userType: "customer",
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ],
    };

    // Count total matching customers
    const totalCustomers = await User.countDocuments(searchQuery);

    // Fetch paginated data
    const customers = await User.find(searchQuery)
      .sort({ createdAt: -1 }) // Newest first
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select("name email phone createdAt walletBalance loyaltyPoints")
      .lean();

    // Format response as per table UI
    const formattedCustomers = customers.map((customer) => ({
      userId: customer._id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      platform: "Web", // replace if tracking platform
      createdAt: customer.createdAt,
      walletBalance: customer.walletBalance,
      loyaltyPoints: customer.loyaltyPoints,
    }));

    return res.status(200).json({
      success: true,
      message: "Customers fetched successfully",
      messageType: "success",
      data: {
        customers: formattedCustomers,
        pagination: {
          total: totalCustomers,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalCustomers / limit),
        },
      },
    });

  } catch (error) {
    console.error("Error fetching customers:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching customers",
      messageType: "failure",
    });
  }
};




exports.getOrdersByCustomerForAdmin = async (req, res) => {
  try {
    const { customerId, status, paymentStatus, startDate, endDate, page = 1, limit = 20 } = req.query;

    if (!customerId) {
      return res.status(400).json({
        messageType: "failure",
        message: "Customer ID is required."
      });
    }

    // Build query object
    const query = { customer: customerId };
    if (status) query.orderStatus = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const total = await Order.countDocuments(query);

    const orders = await Order.find(query)
      .populate("restaurant", "name")
      .populate("customer", "name email phone")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    if (!orders.length) {
      return res.status(404).json({
        messageType: "failure",
        message: "No orders found for this customer."
      });
    }

    return res.status(200).json({
      success: true,
      messageType: "success",
      message: "Customer orders fetched successfully.",
      data: orders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    console.error("Error fetching customer orders:", err);
    res.status(500).json({
      messageType: "failure",
      message: "Internal server error."
    });
  }
};
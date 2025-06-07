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
const AgentEarning = require("../models/AgentEarningModel")
const Order =  require("../models/orderModel")
const RestaurantEarning = require("../models/RestaurantEarningModel")
const Product = require("../models/productModel")
const Restaurant = require("../models/restaurantModel")


exports.addAgentEarnings = async ({ agentId, orderId, amount, type, remarks = null }) => {
  try {
    // Check if earning already exists to avoid duplicate
    const existing = await AgentEarning.findOne({ agentId, orderId, type });
    if (existing) {
      return existing; // Return existing earning if found
    }

    // Create a new earning record
    const earning = new AgentEarning({
      agentId,
      orderId,
      amount,
      type,
      remarks
    });

    await earning.save();
    return earning;
  } catch (error) {
    throw new Error('Error adding agent earning: ' + error.message);
  }
};



/**
 * Add restaurant earnings after order is completed
 */
exports.addRestaurantEarnings = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');

  const restaurantId = order.restaurantId;
  let totalRevenueShareAmount = 0;

  for (let item of order.orderItems) {
    const product = await Product.findById(item.productId);
    if (!product) continue;

    // Calculate revenue share for each item
    let itemRevenue = 0;

    if (product.revenueShare.type === 'percentage') {
      itemRevenue = (item.totalPrice * product.revenueShare.value) / 100;
    } else {
      itemRevenue = product.revenueShare.value * item.quantity;
    }

    totalRevenueShareAmount += itemRevenue;
  }

  const earningRecord = new RestaurantEarning({
    restaurantId,
    orderId,
    totalOrderAmount: order.totalAmount,
    revenueShareAmount: totalRevenueShareAmount,
    revenueShareType: 'percentage', // as this is calculated per product — else can store 'percentage' if unified
    revenueShareValue: 0, // 0 because mixed from multiple products, or you can leave null
    payoutStatus: 'pending'
  });

  await earningRecord.save();

  return earningRecord;
};




exports.createRestaurantEarning = async (order) => {
  try {
    const restaurant = await Restaurant.findById(order.restaurantId);

    if (!restaurant) {
      throw new Error("Restaurant not found for earning calculation.");
    }

    const commissionType = restaurant.commission?.type || "percentage";
    const commissionValue = restaurant.commission?.value || 20; // default 20%

    let commissionAmount = 0;
    let restaurantNetEarning = 0;

    if (commissionType === "percentage") {
      commissionAmount = (order.subtotal * commissionValue) / 100;
    } else if (commissionType === "fixed") {
      commissionAmount = commissionValue;
    }

    restaurantNetEarning = order.subtotal - commissionAmount;

    const newEarning = new RestaurantEarning({
      restaurantId: order.restaurantId,
      orderId: order._id,
      totalOrderAmount: order.subtotal,
      commissionAmount,
      commissionType,
      commissionValue,
      restaurantNetEarning
    });

    await newEarning.save();

    console.log(`Restaurant earning record created for order ${order._id}`);

    return newEarning;
  } catch (error) {
    console.error("Error creating restaurant earning:", error);
    throw error;
  }
};

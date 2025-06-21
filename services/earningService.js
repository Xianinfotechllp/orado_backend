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
  let totalCommissionAmount = 0;

  for (let item of order.orderItems) {
    const product = await Product.findById(item.productId);
    if (!product) continue;

    // Calculate commission for each item
    let itemCommission = 0;

    if (product.revenueShare.type === 'percentage') {
      itemCommission = (item.totalPrice * product.revenueShare.value) / 100;
    } else {
      itemCommission = product.revenueShare.value * item.quantity;
    }

    totalCommissionAmount += itemCommission;
  }

  const totalOrderAmount = order.totalAmount;
  const restaurantNetEarning = totalOrderAmount - totalCommissionAmount;

  const earningRecord = new RestaurantEarning({
    restaurantId,
    orderId,
    totalOrderAmount: totalOrderAmount,
    commissionAmount: totalCommissionAmount,
    commissionType: 'mixed', // if per product varies — otherwise 'percentage' or 'fixed'
    commissionValue: 0, // can leave 0 or null if mixed
    restaurantNetEarning: restaurantNetEarning,
    payoutStatus: 'pending'
  });

  await earningRecord.save();

  return earningRecord;
};
exports.createRestaurantEarning = async (order) => {
  try {
    const restaurant = await Restaurant.findById(order.restaurantId);
    if (!restaurant) throw new Error("Restaurant not found for earning calculation.");

    const commission = restaurant.commission || { type: "percentage", value: 20 };
    const { type: commissionType, value: commissionValue } = commission;

    // Base for commission: cartTotal after offer discount
    const commissionBase = order.cartTotal - (order.offerDiscount || 0);

    let commissionAmount = 0;
    if (commissionType === "percentage") {
      commissionAmount = (commissionBase * commissionValue) / 100;
    } else if (commissionType === "fixed") {
      commissionAmount = commissionValue;
    }

    // Net earning = discounted cart total - commission
    const restaurantNetEarning = commissionBase - commissionAmount;

    const newEarning = new RestaurantEarning({
      restaurantId: order.restaurantId,
      orderId: order._id,
      cartTotal: order.cartTotal,              // ✅ cartTotal here
      offerDiscount: order.offerDiscount || 0,
      offerId: order.offerId || null,
      offerName: order.offerName || null,
      totalOrderAmount: order.totalAmount,
      commissionAmount,
      commissionType,
      commissionValue,
      restaurantNetEarning,
      date: order.createdAt || new Date(),
      remarks: null
    });

    await newEarning.save();
    console.log(`✅ Restaurant earning record created for order ${order._id}`);

    return newEarning;

  } catch (error) {
    console.error("❌ Error creating restaurant earning:", error);
    throw error;
  }
};
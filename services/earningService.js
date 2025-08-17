const AgentEarning = require("../models/AgentEarningModel")
const Order =  require("../models/orderModel")
const RestaurantEarning = require("../models/RestaurantEarningModel")
const Product = require("../models/productModel")
const Restaurant = require("../models/restaurantModel")
const MerchantCommissionSetting = require('../models/merchantCommissionSettingModel');
const calculateEarningsBreakdown = require('../utils/agentEarningCalculator');

const IncentivePlan = require('../models/IncentiveRuleModel');
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
// exports.createRestaurantEarning = async (order) => {
//   try {
//     const restaurant = await Restaurant.findById(order.restaurantId);
//     if (!restaurant) throw new Error("Restaurant not found for earning calculation.");

//     const commission = restaurant.commission || { type: "percentage", value: 20 };
//     const { type: commissionType, value: commissionValue } = commission;

//     // Base for commission: cartTotal after offer discount
//     const commissionBase = order.cartTotal - (order.offerDiscount || 0);

//     let commissionAmount = 0;
//     if (commissionType === "percentage") {
//       commissionAmount = (commissionBase * commissionValue) / 100;
//     } else if (commissionType === "fixed") {
//       commissionAmount = commissionValue;
//     }

//     // Net earning = discounted cart total - commission
//     const restaurantNetEarning = commissionBase - commissionAmount;

//     const newEarning = new RestaurantEarning({
//       restaurantId: order.restaurantId,
//       orderId: order._id,
//       cartTotal: order.cartTotal,              // ✅ cartTotal here
//       offerDiscount: order.offerDiscount || 0,
//       offerId: order.offerId || null,
//       offerName: order.offerName || null,
//       totalOrderAmount: order.totalAmount,
//       commissionAmount,
//       commissionType,
//       commissionValue,
//       restaurantNetEarning,
//       date: order.createdAt || new Date(),
//       remarks: null
//     });

//     await newEarning.save();
//     console.log(`✅ Restaurant earning record created for order ${order._id}`);

//     return newEarning;

//   } catch (error) {
//     console.error("❌ Error creating restaurant earning:", error);
//     throw error;
//   }
// };






exports.calculateRestaurantEarnings = async ({ restaurantId, storeType, orderAmounts }) => {
  const { subtotal, tax, finalAmount } = orderAmounts;

  // Step 1: Try to get merchant-specific commission config
  let commissionConfig = await MerchantCommissionSetting.findOne({
    restaurantId
  });

  // Step 2: Fallback to default config
  if (!commissionConfig) {
    commissionConfig = await MerchantCommissionSetting.findOne({
      isDefault: true
    });
  }

  if (!commissionConfig) {
    throw new Error('Commission configuration not found for this store type.');
  }

  const { commissionType, commissionValue, commissionBase } = commissionConfig;

  // Step 3: Choose base amount
  let baseAmount = 0;
  switch (commissionBase) {
    case 'subtotal+tax':
      baseAmount = subtotal + tax;
      break;
    case 'finalAmount':
      baseAmount = finalAmount;
      break;
    case 'subtotal':
    default:
      baseAmount = subtotal;
      break;
  }

  // Step 4: Calculate commission
  let commissionAmount = 0;
  if (commissionType === 'percentage') {
    commissionAmount = (baseAmount * commissionValue) / 100;
  } else if (commissionType === 'fixed') {
    commissionAmount = commissionValue;
  }

  // Step 5: Calculate merchant earnings
  const merchantEarning = finalAmount - commissionAmount;

  return {
    commissionAmount,
    merchantEarning,
    usedCommissionConfig: {
      commissionType,
      commissionValue,
      commissionBase,
    },
  };
};






exports.createRestaurantEarning = async (order) => {
  try {
    const restaurant = await Restaurant.findById(order.restaurantId);
    if (!restaurant) throw new Error("Restaurant not found for earning calculation.");

    const { subtotal, tax, totalAmount: finalAmount } = order;

    // Use centralized commission config logic
    const earningData = await exports.calculateRestaurantEarnings({
      restaurantId: order.restaurantId,
      storeType: restaurant.storeType || null,
      orderAmounts: {
        subtotal,
        tax,
        finalAmount
      }
    });

    const newEarning = new RestaurantEarning({
      restaurantId: order.restaurantId,
      orderId: order._id,
      cartTotal: subtotal,
      offerDiscount: order.offerDiscount || 0,
      offerId: order.offerId || null,
      offerName: order.offerName || null,
      totalOrderAmount: finalAmount,
      commissionAmount: earningData.commissionAmount,
      commissionType: earningData.usedCommissionConfig.commissionType,
      commissionValue: earningData.usedCommissionConfig.commissionValue,
      restaurantNetEarning: earningData.merchantEarning,
      date: order.createdAt || new Date(),
      payoutStatus: 'pending',
      earningStatus: order.status === 'delivered' ? 'finalized' : 'pending',
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




exports.calculateIncentivesForAgent = async (agentId, date = new Date()) => {
  // Clone date to avoid mutations
  const currentDate = new Date(date);

  // 1. Fetch active incentive plans
  const incentivePlans = await IncentivePlan.find({
    isActive: true,
    $or: [
      { validTo: null },
      { validTo: { $gte: currentDate } }
    ],
    validFrom: { $lte: currentDate }
  });

  let totalIncentive = 0;
  const incentiveBreakdown = [];

  for (const plan of incentivePlans) {
    let startDate;
    let endDate;

    // 2. Determine date range based on plan.period
    if (plan.period === 'daily') {
      startDate = new Date(currentDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(currentDate);
      endDate.setHours(23, 59, 59, 999);

    } else if (plan.period === 'weekly') {
      // Start of week (Sunday)
      startDate = new Date(currentDate);
      startDate.setDate(startDate.getDate() - startDate.getDay());
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);

    } else if (plan.period === 'monthly') {
      startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    // 3. Get earnings in that period (excluding surge & tip)
    const earnings = await AgentEarning.find({
      agentId,
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const totalEligibleEarnings = earnings.reduce((sum, e) => {
      return sum + (e.baseDeliveryFee || 0) + (e.extraDistanceFee || 0);
    }, 0);

    // 4. Check all conditions for this plan
    for (const cond of plan.conditions) {
      let meetsCondition = false;

      if (cond.conditionType === 'earnings') {
        meetsCondition = totalEligibleEarnings >= cond.threshold;
      } else if (cond.conditionType === 'deliveries') {
        meetsCondition = earnings.length >= cond.threshold;
      }

      if (meetsCondition) {
        totalIncentive += cond.incentiveAmount;
        incentiveBreakdown.push({
          planName: plan.name,
          period: plan.period,
          conditionMet: cond,
          earned: cond.incentiveAmount
        });
      }
    }
  }

  return {
    totalIncentive,
    incentiveBreakdown
  };
};



exports.createAgentEarning = async ({
  agentId,
  orderId,
  earningsConfig,
  surgeZones = [],
  incentiveBonuses = {},
  distanceKm,  // <-- passed from outside
}) => {
  // Fetch order document from DB
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  const tipAmount = order.tipAmount || 0;

  // Calculate earnings breakdown using the utility function
  const earningsData = calculateEarningsBreakdown({
    distanceKm,
    config: earningsConfig,
    surgeZones,
    tipAmount,
    incentiveBonuses,
  });

  // Create and save with explicit fields matching your model
  const agentEarning = new AgentEarning({
    agentId,
    orderId: order._id,
    baseDeliveryFee: earningsData.baseFee,
    distanceBeyondBaseKm: earningsData.distanceBeyondBase,
    extraDistanceFee: earningsData.extraDistanceEarning,
    surgeAmount: earningsData.surgeAmount,
    tipAmount,
    incentiveAmount: (incentiveBonuses.peakHourBonus || 0) + (incentiveBonuses.rainBonus || 0),
    payoutStatus: 'pending',
    totalEarning:earningsData.totalEarning
    // totalEarning auto-calculated in pre-save hook
  });

  await agentEarning.save();

  return agentEarning;
};


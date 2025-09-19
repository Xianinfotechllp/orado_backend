const LoyaltySettings = require("../models/LoyaltySettingModel");
const LoyaltyPointTransaction = require("../models/loyaltyTransactionModel");
const User = require("../models/userModel");
const mongoose = require("mongoose");
/**
 * Award loyalty points for an order
 */
exports.awardPoints = async (userId, orderId, totalAmount) => {
  const settings = await LoyaltySettings.findOne();
  if (!settings) return;

  if (totalAmount < settings.minOrderAmountForEarning) return;

  const points = Math.min(
    Math.floor((totalAmount / 100) * settings.pointsPerAmount),
    settings.maxEarningPoints
  );

  if (points <= 0) return; // safety check

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + settings.expiryDurationDays);

  await LoyaltyPointTransaction.create({
    customerId: userId,
    orderId,
    description: `Earned by Order #${orderId}`,
    points,
    transactionType: 'earned',
    expiryDate,
    status: 'active'
  });

  await User.findByIdAndUpdate(userId, {
    $inc: { loyaltyPoints: points }
  });
};

/**
 * Redeem loyalty points
 */
exports.redeemPoints = async (userId, pointsToRedeem, orderId = null) => {
  const settings = await LoyaltySettings.findOne();
  if (!settings) return { success: false, message: "Loyalty settings missing" };

  const user = await User.findById(userId);
  if (!user || user.loyaltyPoints < pointsToRedeem) {
    return { success: false, message: "Insufficient loyalty points" };
  }

  await LoyaltyPointTransaction.create({
    customerId: userId,
    orderId,
    description: `Redeemed for Order #${orderId || "N/A"}`,
    points: -pointsToRedeem,
    transactionType: 'redeemed',
    status: 'redeemed'
  });

  await User.findByIdAndUpdate(userId, {
    $inc: { loyaltyPoints: -pointsToRedeem }
  });

  return { success: true, message: "Points redeemed successfully" };
};













exports.redeemLoyaltyPoints = async (userId, order) => {
  const pointsToRedeem = order.loyaltyPointsUsed || 0;
  if (!pointsToRedeem) return { success: true, message: "No points to redeem" };

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Re-check user and balance inside transaction (prevents race conditions)
    const user = await User.findById(userId).session(session);
    if (!user) throw new Error("User not found");
    if ((user.loyaltyPoints || 0) < pointsToRedeem) {
      throw new Error("Insufficient loyalty points");
    }

    // Deduct points
    await User.findByIdAndUpdate(
      userId,
      { $inc: { loyaltyPoints: -pointsToRedeem } },
      { session }
    );

    // Create transaction record (pending)
    await LoyaltyPointTransaction.create(
      [
        {
          customerId: userId,
          orderId: order._id,
          description: `Redeemed for Order #${order._id.toString().slice(-6)}`,
          points: -pointsToRedeem,
          transactionType: "redeemed",
          status: "redeemed",
          amountValue: order.loyaltyPointsValue || 0, // ₹ value of redeemed points
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();
    return { success: true, message: "Points locked and transaction created", points: pointsToRedeem };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    return { success: false, message: err.message || "Redeem failed" };
  }
}
/**
 * Expire old points (for cron job)
 */
exports.expireOldPoints = async () => {
  const expiredTransactions = await LoyaltyPointTransaction.updateMany(
    { expiryDate: { $lte: new Date() }, status: 'active' },
    { $set: { status: 'expired', transactionType: 'expired' } }
  );

  console.log(`Expired ${expiredTransactions.modifiedCount} loyalty point transactions.`);
};

/**
 * Get user's transaction history
 */
exports.getTransactionHistory = async (userId) => {
  return LoyaltyPointTransaction.find({ customerId: userId })
    .sort({ createdAt: -1 })
    .lean();
};

const LoyaltySettings = require("../models/LoyaltySettingModel");
const LoyaltyPointTransaction = require("../models/loyaltyTransactionModel");
const User = require("../models/userModel");

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

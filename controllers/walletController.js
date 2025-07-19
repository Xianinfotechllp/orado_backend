const User = require('../models/userModel')
const WalletTransaction = require('../models/WalletTransaction')
const logAccess = require('../utils/logAccess')
const razorpay = require("../utils/razorpay");

const crypto = require("crypto");
// walletController.js
exports.initiateWalletTopUp = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    // In the future, integrate with Razorpay, Stripe etc.
    // For now, just return mock "payment" data
      const razorpayOrder = await razorpay.orders.create({
      amount: amount * 100, // ₹10 => 1000 paise
      currency: "INR",
      receipt: `wallet_topup_${userId}`,
      payment_capture: 1,
    })

      res.status(200).json({
      success: true,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID, // Send to frontend
    });
  } catch (error) {
    console.error("initiateWalletTopUp error:", error);
    res.status(500).json({
      error: "Failed to initiate wallet top-up",
    });
  }
};
exports.verifyAndCreditWallet = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.user.id;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment details" });
    }

    // Step 1: Verify signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Payment verification failed" });
    }

    // Step 2: (Optional) Verify order via Razorpay API if needed

    // Step 3: Credit wallet
    const amountInPaise = parseInt(req.body.amount); // from frontend

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.walletBalance += amountInPaise / 100;
    await user.save();

    await WalletTransaction.create({
      user: user._id,
      type: "credit",
      amount: amountInPaise / 100,
      description: `Wallet top-up via Razorpay payment ID: ${razorpay_payment_id}`,
    });

    res.status(200).json({ success: true, message: "Wallet credited successfully" });
  } catch (error) {
    console.error("verifyAndCreditWallet error:", error);
    res.status(500).json({ error: "Failed to verify and credit wallet" });
  }
};







exports.getWalletBalance = async (req, res) => {
  try {
    const userId = req.user._id; 

    const user = await User.findById(userId).select("walletBalance");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      success: true,
      walletBalance: user.walletBalance,
    });
  } catch (error) {
    console.error("getWalletBalance error:", error);
    res.status(500).json({ error: "Failed to fetch wallet balance" });
  }
};


// For Admin Only, refund on order
exports.refundToWallet = async (req, res) => {
  try {
    const { userId, orderId, amount, description = "" } = req.body;
    const adminId = req.user?.id || "admin"; // fallback if no JWT/middleware

    if (!userId || !orderId || !amount) {
      return res.status(400).json({ error: "userId, orderId, and amount are required." });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Step 1: Credit to wallet
    user.walletBalance = (user.walletBalance || 0) + amount;
    await user.save();

    // Step 2: Save wallet transaction
    const transaction = new WalletTransaction({
      user: userId,
      type: "refund",
      amount,
      description: description || `Refund for Order #${orderId}`,
    });
    await transaction.save();

    // Step 3: Log the admin action
    await logAccess({
      userId: adminId,
      action: "AdminRefund",
      description: `Admin refunded ₹${amount} to user ${userId} for order ${orderId}`,
      req,
      metadata: {
        refundedAmount: amount,
        orderId,
        targetUser: userId,
        walletBalanceAfter: user.walletBalance,
      },
    });

    res.status(200).json({
      message: "Refund processed and wallet credited.",
      walletBalance: user.walletBalance,
      transaction,
    });
  } catch (err) {
    console.error("Refund error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


// Fetch all refund transactions
exports.getAllRefundTransactions = async (req, res) => {
  try {
    const transactions = await WalletTransaction.find({ type: "refund" })
      .populate("user", "name email") // populate user info
      .sort({ createdAt: -1 });

    res.status(200).json(transactions);
  } catch (err) {
    console.error("Error fetching refund transactions:", err);
    res.status(500).json({ error: "Failed to fetch refund transactions." });
  }
};

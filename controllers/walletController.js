const User = require('../models/userModel')
const WalletTransaction = require('../models/WalletTransaction')
const logAccess = require('../utils/logAccess')
const razorpay = require("../utils/razorpay");

const crypto = require("crypto");
// walletController.js
exports.initiateWalletTopUp = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user._id;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    // Step 1: Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: amount * 100, // convert to paise
      currency: "INR",
      receipt: `wallet_topup_${userId}`,
      payment_capture: 1, // auto capture
    });

    // Step 2: Create pending WalletTransaction
    const walletTransaction = await WalletTransaction.create({
      user: userId,
      type: "credit",
      amount: amount,
      status: "pending", // pending until webhook confirms
      description: `Wallet top-up initiated via Razorpay order ${razorpayOrder.id}`,
      razorpayOrderId: razorpayOrder.id,
    });

    // Step 3: Return order info to frontend
    res.status(200).json({
      success: true,
      orderId: razorpayOrder.id,
      transactionId: walletTransaction._id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("initiateWalletTopUp error:", error);
    res.status(500).json({ error: "Failed to initiate wallet top-up" });
  }
};
exports.verifyAndCreditWallet = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.user._id;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment details" });
    }

    // ✅ Step 1: Verify signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Payment verification failed" });
    }

    // ✅ Step 2: Find pending wallet transaction
    const walletTx = await WalletTransaction.findOne({
      razorpayOrderId: razorpay_order_id,
      user: userId,
      status: "pending",
    });

    if (!walletTx) {
      return res.status(404).json({ error: "Wallet transaction not found or already processed" });
    }

    // ✅ Step 3: Update wallet & mark transaction success
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.walletBalance += walletTx.amount; // use stored amount, not frontend
    await user.save();

    walletTx.status = "success";
    walletTx.description = `Wallet top-up verified via Razorpay payment ID: ${razorpay_payment_id}`;
    walletTx.razorpayPaymentId = razorpay_payment_id;
    await walletTx.save();

    res.status(200).json({
      success: true,
      message: "Wallet credited successfully",
      balance: user.walletBalance,
    });
  } catch (error) {
    console.error("verifyAndCreditWallet error:", error);
    res.status(500).json({ error: "Failed to verify and credit wallet" });
  }
};

exports.getUserWalletTransactions = async (req, res) => {
  try {
    const userId = req.user._id;

    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;

    const total = await WalletTransaction.countDocuments({ user: userId });

    const skip = (page - 1) * limit;

    // Fetch paginated transactions
    const transactions = await WalletTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      transactions,
      total,            
      page,
      limit,
      pages: Math.ceil(total / limit),
      hasNextPage: (page * limit) < total,
      hasPrevPage: page > 1
    });
  } catch (error) {
    console.error("Error fetching user's wallet transactions:", error);
    res.status(500).json({ error: "Failed to fetch wallet transactions." });
  }
};
exports.getTransactionStatusByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;
    
    const transaction = await WalletTransaction.findOne({ 
      razorpayOrderId: orderId,
      user: userId
    });
    
    if (!transaction) {
      return res.status(404).json({ 
        error: "Transaction not found",
        status: "not_found"
      });
    }
    
    res.status(200).json({
      status: transaction.status,
      amount: transaction.amount,
      type: transaction.type,
      description: transaction.description,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt
    });
  } catch (error) {
    console.error("getTransactionStatus error:", error);
    res.status(500).json({ error: "Failed to get transaction status" });
  }
}


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




exports.razorpayWebhook = async (req, res) => {
  try {
    // Step 1: Verify webhook signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];
    const body = JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const event = req.body.event;

    // ✅ Step 2: Handle events
    if (event === "payment.captured") {
      // Success case
      const payment = req.body.payload.payment.entity;
      const razorpayOrderId = payment.order_id;
      const amount = payment.amount / 100; // paise → INR

      const walletTx = await WalletTransaction.findOne({
        razorpayOrderId,
        status: "pending",
      });
      if (!walletTx) return res.status(404).json({ error: "Wallet transaction not found" });

      const user = await User.findById(walletTx.user);
      if (!user) return res.status(404).json({ error: "User not found" });

      user.walletBalance += amount;
      await user.save();

      walletTx.status = "success";
      walletTx.description = `Wallet top-up via Razorpay payment ID: ${payment.id}`;
      await walletTx.save();
    }

    else if (event === "payment.failed") {
      // Failure case
      const payment = req.body.payload.payment.entity;
      const razorpayOrderId = payment.order_id;

      const walletTx = await WalletTransaction.findOne({
        razorpayOrderId,
        status: "pending",
      });
      if (!walletTx) return res.status(404).json({ error: "Wallet transaction not found" });

      walletTx.status = "failed";
      walletTx.description = `Payment failed. Reason: ${payment.error_description || "Unknown"}`;
      await walletTx.save();
    }

    res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("Razorpay webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
};
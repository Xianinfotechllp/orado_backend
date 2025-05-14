const Coupon = require('../models/couponModel');
const User = require('../models/userModel'); // optional: for validation if needed

// Create Coupon
exports.createCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.create(req.body);
    res.status(201).json({ message: 'Coupon created successfully', coupon });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while creating coupon', error: error.message });
  }
};

// Get All Coupons
exports.getAllCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find();
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch coupons', error: error.message });
  }
};

// Get Coupon by Code
exports.getCouponByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    res.json(coupon);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching coupon', error: error.message });
  }
};

// Update Coupon
exports.updateCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const updatedCoupon = await Coupon.findByIdAndUpdate(couponId, req.body, { new: true });

    if (!updatedCoupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    res.json({ message: 'Coupon updated successfully', coupon: updatedCoupon });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update coupon', error: error.message });
  }
};

// Delete Coupon
exports.deleteCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const deleted = await Coupon.findByIdAndDelete(couponId);

    if (!deleted) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    res.json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete coupon', error: error.message });
  }
};

// Validate Coupon for an Order
exports.validateCoupon = async (req, res) => {
  try {
    const { code, userId, totalAmount } = req.body;
    const now = new Date();

    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      isActive: true,
      validFrom: { $lte: now },
      validTill: { $gte: now }
    });

    if (!coupon) return res.status(404).json({ message: 'Coupon is invalid or expired' });

    if (coupon.minOrderAmount > totalAmount) {
      return res.status(400).json({ message: `Minimum order amount not met (₹${coupon.minOrderAmount})` });
    }

    if (
      coupon.usageLimit > 0 &&
      coupon.usersUsed.includes(userId)
    ) {
      return res.status(403).json({ message: 'Coupon already used by this user' });
    }

    if (
      coupon.globalUsageLimit > 0 &&
      coupon.usedCount >= coupon.globalUsageLimit
    ) {
      return res.status(403).json({ message: 'Coupon usage limit reached' });
    }

    res.json({
      message: 'Coupon is valid',
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscount: coupon.maxDiscount || null
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to validate coupon', error: error.message });
  }
};

// Mark Coupon as Used by User
exports.markCouponAsUsed = async (req, res) => {
  try {
    const { code, userId } = req.body;
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });

    if (!coupon.usersUsed.includes(userId)) {
      coupon.usersUsed.push(userId);
    }

    coupon.usedCount += 1;
    await coupon.save();

    res.json({ message: 'Coupon usage recorded' });
  } catch (error) {
    res.status(500).json({ message: 'Error marking coupon as used', error: error.message });
  }
};

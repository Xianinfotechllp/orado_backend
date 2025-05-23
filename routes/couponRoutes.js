const express = require('express');
const {
  createCoupon,
  getAllCoupons,
  getCouponByCode,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  markCouponAsUsed
} = require('../controllers/couponController');
const { protect, checkRole } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/create', protect, checkRole('merchant', 'admin', 'superAdmin'), createCoupon);
router.get('/', protect, checkRole('customer', 'merchant', 'admin', 'superAdmin'), getAllCoupons);
router.get('/:code', protect, checkRole('customer', 'merchant', 'admin', 'superAdmin'), getCouponByCode);
router.put('/:couponId', protect, checkRole('merchant', 'admin', 'superAdmin'), updateCoupon);
router.delete('/:couponId', protect, checkRole('merchant', 'admin', 'superAdmin'), deleteCoupon);

// Validation
router.post('/validate', validateCoupon);
router.post('/mark-used', markCouponAsUsed);

module.exports = router;

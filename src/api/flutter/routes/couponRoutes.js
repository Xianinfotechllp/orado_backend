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

const router = express.Router();

router.post('/create', createCoupon);
router.get('/', getAllCoupons);
router.get('/:code', getCouponByCode);
router.put('/:couponId', updateCoupon);
router.delete('/:couponId', deleteCoupon);

// Validation
router.post('/validate', validateCoupon);
router.post('/mark-used', markCouponAsUsed);

module.exports = router;

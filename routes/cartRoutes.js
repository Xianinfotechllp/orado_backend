const express = require('express');
const { addToCart, getCart, updateCartItem, removeFromCart, clearCart} = require('../controllers/cartController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/add', protect, addToCart);
// router.post("/add2",protect,addToCart2)
router.get('/', protect, getCart);
router.put('/update', protect, updateCartItem);
router.delete('/remove', protect, removeFromCart);
router.delete('/clear', protect, clearCart);






module.exports = router;

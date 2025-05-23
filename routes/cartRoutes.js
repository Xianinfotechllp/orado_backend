const express = require('express');
const { addToCart, getCart, updateCartItem, removeFromCart, clearCart,addMultipleToCart } = require('../controllers/cartController');
const router = express.Router();

router.post('/add', addToCart);
router.get('/:userId', getCart);
router.put('/update', updateCartItem);
router.delete('/remove', removeFromCart);
router.delete('/clear/:userId', clearCart);






module.exports = router;

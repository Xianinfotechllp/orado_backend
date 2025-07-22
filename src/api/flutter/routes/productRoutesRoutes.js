const express = require('express');
const { createProduct, getRestaurantProducts, updateProduct, deleteProduct, toggleProductActive } = require('../controllers/productController');
const router = express.Router();

router.post('/:restaurantId/products', createProduct);
router.get('/:restaurantId/products', getRestaurantProducts);
router.put('/products/:productId', updateProduct);
router.delete('/products/:productId', deleteProduct);
router.put('/products/:productId/auto-on-off', toggleProductActive);

module.exports = router;


const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.post('/restaurants/:restaurantId', productController.createProduct);
router.get('/restaurants/:restaurantId', productController.getRestaurantProducts);
router.put('/restaurants/products/:productId', productController.updateProduct);
router.delete('/restaurants/products/:productId', productController.deleteProduct);
router.put('/restaurants/products/:productId/auto-on-off', productController.toggleProductActive);

module.exports = router;

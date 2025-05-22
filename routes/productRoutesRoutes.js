const express = require('express');
const { upload } = require('../middlewares/multer');
const { createProduct, getRestaurantProducts, updateProduct, deleteProduct, toggleProductActive } = require('../controllers/productController');
const { protect, checkRole } = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/:restaurantId/products', protect, checkRole('merchant'), upload.array('images'), createProduct);
router.get('/:restaurantId/products', protect, checkRole('merchant', 'customer'), getRestaurantProducts);
router.put('/products/:productId', protect, checkRole('merchant'),  upload.array('images'), updateProduct);
router.delete('/products/:productId', protect, checkRole('merchant'), deleteProduct);
router.put('/products/:productId/auto-on-off', protect, checkRole('merchant'), toggleProductActive);

module.exports = router;


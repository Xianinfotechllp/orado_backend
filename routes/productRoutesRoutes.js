const express = require('express');
const { upload } = require('../middlewares/multer');
const { createProduct, getRestaurantProducts, updateProduct, deleteProduct, toggleProductActive } = require('../controllers/productController');
const router = express.Router();

router.post('/:restaurantId/products', upload.array('images'), createProduct);
router.get('/:restaurantId/products', getRestaurantProducts);
router.put('/products/:productId', upload.array('images'), updateProduct);
router.delete('/products/:productId', deleteProduct);
router.put('/products/:productId/auto-on-off', toggleProductActive);

module.exports = router;


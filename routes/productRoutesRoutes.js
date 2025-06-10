const express = require('express');
const { upload } = require('../middlewares/multer');
const { createProduct, getRestaurantProducts, updateProduct, deleteProduct, toggleProductActive ,getCategoryProducts} = require('../controllers/productController');
const { protect, checkRole ,checkRestaurantPermission, checkPermission} = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/:restaurantId/products', protect, checkRole('merchant'), upload.array('images',5),checkRestaurantPermission("canManageMenu",false,"you dont have permission to manage menu"), createProduct);
router.get('/:restaurantId/products', protect, checkRole('merchant', 'customer'), getRestaurantProducts);



router.put('/products/:productId', protect, checkRole('merchant','superAdmin'),  upload.array('images'), updateProduct);
router.delete('/products/:productId', protect, checkRole('merchant','superAdmin'), deleteProduct);
router.put('/products/:productId/auto-on-off', protect, checkRole('merchant'), toggleProductActive);


router.get("/:restaurantId/products/category/:categoryId",getCategoryProducts)





module.exports = router;


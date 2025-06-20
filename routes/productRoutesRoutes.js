const express = require('express');
const { upload } = require('../middlewares/multer');
const { protect, checkRole ,checkRestaurantPermission, checkPermission, attachRestaurantFromProduct} = require('../middlewares/authMiddleware');
const { createProduct, getRestaurantProducts, updateProduct, deleteProduct, toggleProductActive ,getMyRestaurantProducts, getProductsBasedRestaurant, getCategoryProducts,toggleProductStatus, exportProductsToExcel, bulkUpdateProducts } = require('../controllers/productController');
const router = express.Router();

router.post('/:restaurantId/products', protect, checkRole('merchant'), upload.array('images',5),checkRestaurantPermission("canManageMenu",false,"you dont have permission to manage menu"), createProduct);
router.get('/:restaurantId/products', protect, checkRole('merchant', 'customer'), getRestaurantProducts);



router.put('/products/:productId', protect, checkRole('merchant','superAdmin'), attachRestaurantFromProduct,checkRestaurantPermission("canManageMenu",false,"you dont have permission to manage menu"), upload.array('images'),updateProduct);
router.delete('/products/:productId', protect, checkRole('merchant','superAdmin'), attachRestaurantFromProduct,checkRestaurantPermission("canManageMenu",false,"you dont have permission to manage menu"), deleteProduct);
router.put('/products/:productId/auto-on-off', protect, checkRole('merchant'), toggleProductActive);
router.get('/products', protect, checkRole('merchant'), getMyRestaurantProducts);
// router.get("/:restaurantId/products", protect, checkRole('merchant') ,getProductsBasedRestaurant)
router.patch("/products/:productId/toggle",protect,toggleProductStatus )


router.get("/:restaurantId/products/category/:categoryId",getCategoryProducts)

//excel sheet 

router.get("/:restaurantId/products/export",async (req, res) => {
try {
    const { restaurantId } = req.params;
    const workbook = await exportProductsToExcel(restaurantId);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=products-${restaurantId}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Failed to export products:', err);
    res.status(500).json({ message: 'Failed to export products' });
  }
}
)


router.post("/:restaurantId/products/bulk-update",upload.single('file'), bulkUpdateProducts)





module.exports = router;


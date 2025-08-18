const express = require('express')
const router = express.Router()

const {createCategory,getAResturantCategories,editResturantCategory,deleteResturantCategory} = require('../controllers/categoryController')
const {registerMerchant, loginMerchant,  logoutMerchant, logoutAll, getMerchantDetails} = require('../controllers/merchantController')
const {protect, checkRole, checkRestaurantPermission,attachRestaurantFromProduct} = require('../middlewares/authMiddleware')
const {upload} = require('../middlewares/multer')
const {excelUpload} = require("../middlewares/excelUpload")
const {createRestaurant, updateRestaurant,deleteRestaurant,getRestaurantById, updateBusinessHours,addServiceArea, addKyc, getKyc,getRestaurantMenu, getAllApprovedRestaurants, getRestaurantEarningSummary, getRestaurantsByMerchantId, getRestaurantOrders, getRestaurantEarnings,getServiceAreas, deleteServiceAreas, getRestaurantEarningsList, getRestaurantEarningv2, toggleRestaurantActiveStatus, updateBasicInfo, updateLocationInfo, updateOpeningHours, updateRestaurantImages,toggleActiveStatus}  = require('../controllers/restaurantController')
const {forgotPassword, resetPassword} = require('../controllers/userControllers')
const { createProduct, getRestaurantProducts, updateProduct, deleteProduct, toggleProductActive ,getMyRestaurantProducts, getProductsBasedRestaurant, getCategoryProducts,toggleProductStatus, exportProductsToExcel, bulkUpdateProducts } = require('../controllers/productController');
// get all restruants (for users)

router.get("/all-restaurants", getAllApprovedRestaurants)
// merchant login/register
router.post("/register-restaurant", upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'fssaiDoc', maxCount: 1 },
    { name: 'gstDoc', maxCount: 1 },
    { name: 'aadharDoc', maxCount: 1 }
  ]),createRestaurant);
router.post("/register-merchant", registerMerchant)
router.post("/login", loginMerchant)
router.post("/forgot-password", protect, checkRole('merchant'), forgotPassword)
router.post("/reset-password/:token", protect, checkRole('merchant'), resetPassword)
router.post("/logout", protect, checkRole('merchant'), logoutMerchant)
router.get('/merchant', protect, getMerchantDetails); 
router.post("/logout-all", protect, checkRole('merchant'), logoutAll)
router.get('/merchant/restaurants', protect,  getRestaurantsByMerchantId);

// restaurant routes
router.post(
  '/',
  upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'fssaiDoc', maxCount: 1 },
    { name: 'gstDoc', maxCount: 1 },
    { name: 'aadharDoc', maxCount: 1 }
  ]),
  protect, checkRole('merchant'), createRestaurant);
// router.post("/register",register)
router.put(
  "/:restaurantId",
  upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'fssaiDoc', maxCount: 1 },
    { name: 'gstDoc', maxCount: 1 },
    { name: 'aadharDoc', maxCount: 1 },
  ]),
  protect,
  checkRole('merchant'),
  updateRestaurant
);

router.put("/:restaurantId/basic",protect, checkRole('merchant'),updateBasicInfo)
router.put("/:restaurantId/location",protect,updateLocationInfo)
router.put("/:restaurantId/opening-hours", protect, updateOpeningHours);
router.delete("/:restaurantId", protect, checkRole('merchant'), deleteRestaurant)
// router.get("/:restaurantId", protect, checkRole('merchant'), getRestaurantById)


router.put("/:restaurantId/images", protect, upload.fields([{ name: 'images', maxCount: 5 }]), updateRestaurantImages);

router.get("/:restaurantId",getRestaurantById)

router.put("/:restaurantId/business-hours", protect, checkRole('merchant'), updateBusinessHours)




router.post('/:restaurantId/service-areas', protect, checkRole('merchant'), addServiceArea)
router.get("/:restaurantId/service-areas",protect, checkRole('merchant'),getServiceAreas)
router.delete("/:restaurantId/service-areas",protect,checkRole('merchant'),deleteServiceAreas)
// kyc
router.post('/:restaurantId/kyc', upload.array('documents'), protect, checkRole('merchant'), addKyc);
router.get('/kyc/:restaurantId', protect, checkRole('merchant'), getKyc);


//categories routes
router.post("/:restaurantId/categories",upload.array('images', 5), protect, checkRole('merchant'), checkRestaurantPermission("canManageMenu",false,"you dont have permission to manage menu"), createCategory);
router.get("/:restaurantId/categories", protect, checkRole('merchant'), getAResturantCategories)
router.put('/categories/:categoryId', upload.single('images'), protect, checkRole('merchant'), editResturantCategory);
router.delete('/:restaurantId/categories/:categoryId', protect, checkRole('merchant'), deleteResturantCategory)


//get restaurant menu

router.get("/:restaurantId/menu",getRestaurantMenu)

// get restaurant earnigs
router.get("/:restaurantId/earnings/summary",protect,checkRole('merchant'),getRestaurantEarningSummary)
router.get("/:restaurantId/earnings",protect,getRestaurantEarnings)
router.get("/:restaurantId/earnings-list",protect,getRestaurantEarningsList)

router.get("/:restaurantId/earningsv2",protect,getRestaurantEarningv2)


router.get("/:restaurantId/myorders",protect,checkRole('merchant'),getRestaurantOrders) 



router.put("/:restaurantId/toggle-active",protect, toggleRestaurantActiveStatus);
// restaurant order stauts update 
// router.get("/orders/:id/status",)
































// router.post('/:restaurantId/products', protect, checkRole('merchant'), upload.array('images',5),checkRestaurantPermission("canManageMenu",false,"you dont have permission to manage menu"), createProduct);
router.post('/:restaurantId/products', protect, checkRole('merchant'), upload.array('images',5),createProduct);

router.get('/:restaurantId/products', protect, checkRole('merchant', 'customer'), getRestaurantProducts);



router.put('/products/:productId', protect, checkRole('merchant','superAdmin'), attachRestaurantFromProduct,checkRestaurantPermission("canManageMenu",false,"you dont have permission to manage menu"), upload.array('images'),updateProduct);
router.delete('/products/:productId', protect, checkRole('merchant','superAdmin'), attachRestaurantFromProduct,checkRestaurantPermission("canManageMenu",false,"you dont have permission to manage menu"), deleteProduct);
router.put('/products/:productId/auto-on-off', protect, checkRole('merchant'), toggleProductActive);
router.get('/products', protect, checkRole('merchant'), getMyRestaurantProducts);
// router.get("/:restaurantId/products", protect, checkRole('merchant') ,getProductsBasedRestaurant)
router.put("/products/:productId/toggle",protect,toggleProductStatus )


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

            
router.post(
  "/:restaurantId/products/bulk-update",
  protect,
  checkRole('merchant'),
  excelUpload.single("file"),
  bulkUpdateProducts
);




// router.get("/:restaurantId/products/category/:categoryId",getCategoryProducts)








module.exports = router
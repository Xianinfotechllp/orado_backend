const express = require("express");
const router = express.Router();

const {
  adminLogin, getPendingAgentRequests, approveAgentApplication, getPendingRestaurantApprovals,
  updateRestaurantApprovalStatus, logoutAdmin, logoutAll, getPendingChangeRequests, getPermissions,
  updatePermissions, reviewChangeRequest, createAdmin, deleteAdmin, updateAdminPermissions,
  getAllAdmins, getAllAgentPermissionRequests, handleAgentPermissionRequest, getAllAccessLogs,
  getMyLogs, getRestaurantById, updatePermissionsRestuarants, getRestaurantsWithPermissions,
  updateRestaurant, getRestaurantCategory, createCategory, getCategoryProducts, createProduct,updateProduct,
  updateCategory,
  deleteCategory,
getApprovedRestaurants ,
   getAdminProfileById, updateAdminProfile, updateAdminPassword, getOrdersByCustomerAdmin
  
} = require("../controllers/adminController");
const {refundToWallet, getAllRefundTransactions} = require('../controllers/walletController')
const {getAllMerchants} = require("../controllers/admin/merchantContollers")
const {createSurgeArea, getSurgeAreas ,  toggleSurgeAreaStatus,deleteSurgeArea } = require("../controllers/admin/surgeController")

const { importMenuFromExcel,setRestaurantCommission } = require("../controllers/admin/restaurantController");
const { getUserStats } = require("../controllers/admin/userController");

const { getRestaurantStats  } = require("../controllers/admin/restaurantController");

const {getActiveOrdersStats,getSimpleRectOrderStats} = require("../controllers/admin/orderController")
const { protect, checkRole, checkPermission } = require('../middlewares/authMiddleware');
const { upload } = require("../middlewares/multer");
const {createRestaurant} = require("../controllers/admin/restaurantController")


const {createOffer,getAllOffers,getRestaurantsWithOffersAggregated} = require("../controllers/offerController");
const { addTax, getAllTaxes, deleteTax} = require("../controllers/admin/taxAndFeeSettingController");
// Authentication routes
router.post("/login", adminLogin);
router.post("/logout", protect, checkRole('admin', 'superAdmin'), logoutAdmin);
router.post("/logout-all", protect, checkRole('admin', 'superAdmin'), logoutAll);

router.post("/creat-restaurant",upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'fssaiDoc', maxCount: 1 },
    { name: 'gstDoc', maxCount: 1 },
    { name: 'aadharDoc', maxCount: 1 }
  ]),createRestaurant)

// Admin management routes (superAdmin only)
router.post("/create-admin", protect, checkRole('superAdmin'), createAdmin);
router.delete("/delete-admin/:adminId", protect, checkRole('superAdmin'), deleteAdmin);
router.put("/update-admin/:adminId", protect, checkRole('superAdmin'), updateAdminPermissions);
router.get("/admins", protect, checkRole('superAdmin'), getAllAdmins);

// Agent management routes
router.get("/agent-requests", protect, checkPermission('agents.manage'), getPendingAgentRequests);
router.post("/agent-application/:userId/approve", protect, checkPermission('agents.manage'), approveAgentApplication);
router.get('/agent-permissions/requests', protect, checkPermission('agents.manage'), getAllAgentPermissionRequests);
router.post('/agent-permissions/review', protect, checkPermission('agents.manage'), handleAgentPermissionRequest);

// Restaurant management routes
router.get("/restaurant-requests", protect, checkPermission('merchants.manage'), getPendingRestaurantApprovals);
router.post("/restaurant-application/:restaurantId/update", protect, checkPermission('merchants.manage'), updateRestaurantApprovalStatus);
router.get("/restaurant/:restaurantId", protect, checkRole('admin', 'superAdmin'), getRestaurantById);
router.put("/edit/restaurant/:restaurantId",upload.array("images",5), protect, checkRole('admin', 'superAdmin'), updateRestaurant);

// Restaurant permissions
router.get('/permissions/:restaurantId', protect, checkPermission('merchants.manage'), getPermissions);
router.put('/permissions/:restaurantId', protect, checkPermission('merchants.manage'), updatePermissions);
router.put("/restuarants/permissions", protect, checkPermission('merchants.manage'), updatePermissionsRestuarants);
router.get("/getrestuarants/permissions", protect, checkPermission('merchants.manage'), getRestaurantsWithPermissions);

// Restaurant change requests
router.get('/change-requests/pending', protect, checkPermission('merchants.manage'), getPendingChangeRequests);
router.post('/change-requests/:requestId/review', protect, checkPermission('merchants.manage'), reviewChangeRequest);

// Restaurant menu/category management
router.get("/restaurant/:restaurantId/category", protect, getRestaurantCategory);
router.post("/restaurant/:restaurantId/category", protect, upload.array('images', 5), createCategory);
router.put("/restaurant/:restaurantId/category/:categoryId", protect, upload.array('images', 5), updateCategory)
router.delete("/restaurant/:restaurantId/category/:categoryId", protect, upload.array('images', 5), deleteCategory)


router.get("/restaurant/:restaurantId/category/:categoryId", protect, getCategoryProducts);
router.post("/restaurant/:restaurantId/product", protect, upload.array('images', 5), createProduct);

router.put("/restaurant/:restaurantId/product/:productId",protect, upload.array('images', 5), updateProduct)
router.post("/restaurant/menu/import-excel",  protect,upload.single("file"), importMenuFromExcel);

// Access logs
router.get("/access-logs", protect, checkRole('superAdmin'), getAllAccessLogs);
router.get("/access-logs/me", protect, checkRole('admin', 'superAdmin'), getMyLogs);

// Stats routes
router.get("/user/user-stats", getUserStats);
router.get("/restaurant/stats/restaurant-stats", getRestaurantStats);
router.get("/order/order-stats", getActiveOrdersStats);
router.get("/order/order-stats/recent",getSimpleRectOrderStats)


// Set restaurant commission (admin only)
router.patch("/restaurant/:restaurantId/commission", setRestaurantCommission); 

router.get("/restaurant/approved/list",getApprovedRestaurants)


// Admin Profile
router.get('/profile', protect, getAdminProfileById);
router.put('/profile', protect, updateAdminProfile);
router.put('/profile/password', protect, updateAdminPassword);

// Refund for a order 
router.post("/wallet/refund", protect, refundToWallet)
router.get("/refund/transactions", protect, getAllRefundTransactions)
// getOrderByCustomer
router.get("/customer-orders/:userId", protect, getOrdersByCustomerAdmin)

router.get("/merchant/getallmerchants",getAllMerchants)



router.post("/offer",createOffer)
router.get("/offer",getAllOffers)

router.get("/restaurants/offer-list",getRestaurantsWithOffersAggregated)

//surge
router.post("/surge/add",createSurgeArea)
router.get("/surge-list",getSurgeAreas)
router.patch("/surge-areas/:surgeAreaId/toggle-status", toggleSurgeAreaStatus);
router.delete("/surge-areas/:surgeAreaId",deleteSurgeArea)


//tax and feees 
router.post("/taxes",addTax)
router.get("/taxes",getAllTaxes)
router.delete("/taxes/:taxId",deleteTax)






module.exports = router;
const express = require("express");
const router = express.Router();

const {
  adminLogin, getPendingAgentRequests, approveAgentApplication, getPendingRestaurantApprovals,
  updateRestaurantApprovalStatus, logoutAdmin, logoutAll, getPendingChangeRequests, getPermissions,
  updatePermissions, reviewChangeRequest, createAdmin, deleteAdmin, updateAdminPermissions,
  getAllAdmins, getAllAgentPermissionRequests, handleAgentPermissionRequest, getAllAccessLogs,
  getMyLogs, getRestaurantById, updatePermissionsRestuarants, getRestaurantsWithPermissions,
  updateRestaurant, getRestaurantCategory, createCategory, getCategoryProducts, createProduct
} = require("../controllers/adminController");

const { importMenuFromExcel } = require("../controllers/admin/restaurantController");
const { getUserStats } = require("../controllers/admin/userController");
const { getRestaurantStats, getActiveOrdersStats } = require("../controllers/admin/restaurantController");
const { protect, checkRole, checkPermission } = require('../middlewares/authMiddleware');
const { upload } = require("../middlewares/multer");

// Authentication routes
router.post("/login", adminLogin);
router.post("/logout", protect, checkRole('admin', 'superAdmin'), logoutAdmin);
router.post("/logout-all", protect, checkRole('admin', 'superAdmin'), logoutAll);

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
router.put("/edit/restaurant/:restaurantId", protect, checkRole('admin', 'superAdmin'), updateRestaurant);

// Restaurant permissions
router.get('/permissions/:restaurantId', protect, checkPermission('merchants.manage'), getPermissions);
router.put('/permissions/:restaurantId', protect, checkPermission('merchants.manage'), updatePermissions);
router.put("/restuarants/permissions", protect, checkPermission('merchants.manage'), updatePermissionsRestuarants);
router.get("/getrestuarants/permissions", protect, checkPermission('merchants.manage'), getRestaurantsWithPermissions);

// Restaurant change requests
router.get('/change-requests/pending', protect, checkPermission('merchants.manage'), getPendingChangeRequests);
router.post('/change-requests/:requestId/review', protect, checkPermission('merchants.manage'), reviewChangeRequest);

// Restaurant menu/category management
router.get("/restaurant/:restaurantId/category", getRestaurantCategory);
router.post("/restaurant/:restaurantId/category", upload.array('images', 5), createCategory);
router.get("/restaurant/:restaurantId/category/:categoryId", getCategoryProducts);
router.post("/restaurant/:restaurantId/product", upload.array('images', 5), createProduct);
router.post("/restaurant/menu/import-excel", upload.single("file"), importMenuFromExcel);

// Access logs
router.get("/access-logs", protect, checkRole('superAdmin'), getAllAccessLogs);
router.get("/access-logs/me", protect, checkRole('admin', 'superAdmin'), getMyLogs);

// Stats routes
router.get("/user/user-stats", getUserStats);
router.get("/restauranteee/restaurant-stats", getRestaurantStats);
router.get("/order/order-stats", getActiveOrdersStats);

module.exports = router;
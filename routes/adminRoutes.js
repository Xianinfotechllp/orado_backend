const express = require("express");
const router = express.Router();
const { adminLogin, getPendingAgentRequests, approveAgentApplication, getPendingRestaurantApprovals, updateRestaurantApprovalStatus, 
    logoutAdmin, logoutAll , getPendingChangeRequests, getPermissions, updatePermissions, reviewChangeRequest, createAdmin, 
    deleteAdmin, updateAdminPermissions, getAllAdmins, getAllAgentPermissionRequests, handleAgentPermissionRequest, getAllAccessLogs, getMyLogs,getRestaurantById,
updatePermissionsRestuarants,getRestaurantsWithPermissions,updateRestaurant} = require("../controllers/adminController");
const {protect, checkRole, checkPermission} = require('../middlewares/authMiddleware')

router.post("/login", adminLogin);
router.post("/logout", protect, checkRole('admin', 'superAdmin'), logoutAdmin);
router.post("/logout-all", protect, checkRole('admin', 'superAdmin'), logoutAll);

router.get("/restaurant/:restaurantId", protect, checkRole('admin', 'superAdmin'),getRestaurantById)

// Create admins(only for superAdmins)
router.post("/create-admin", protect, checkRole('superAdmin'), createAdmin);
router.delete("/delete-admin/:adminId", protect, checkRole('superAdmin'), deleteAdmin);
router.put("/update-admin/:adminId", protect, checkRole('superAdmin'), updateAdminPermissions);
router.get("/admins", protect, checkRole('superAdmin'), getAllAdmins);

//  requests for agent approval
router.get("/agent-requests", protect, checkPermission('agents.manage'), getPendingAgentRequests);
router.post("/agent-application/:userId/approve", protect, checkPermission('agents.manage'), approveAgentApplication);

// requests for merchant approval
router.get("/restaurant-requests", protect, checkPermission('merchants.manage'), getPendingRestaurantApprovals);
router.post("/restaurant-application/:restaurantId/update", protect, checkPermission('merchants.manage'), updateRestaurantApprovalStatus);

//  Merchant Permissions
router.get('/permissions/:restaurantId', protect, checkPermission('merchants.manage'), getPermissions);
router.put('/permissions/:restaurantId', protect, checkPermission('merchants.manage'), updatePermissions);
router.get('/change-requests/pending', protect, checkPermission('merchants.manage'), getPendingChangeRequests);
router.post('/change-requests/:requestId/review', protect, checkPermission('merchants.manage'), reviewChangeRequest);



router.post("/permissions/restuarants",protect, checkPermission('merchants.manage'),updatePermissionsRestuarants)

router.get("/getrestuarants/permissions",protect,checkPermission('merchants.manage'),getRestaurantsWithPermissions)

// Agent Permissions
router.get('/agent-permissions/requests', protect, checkPermission('agents.manage'), getAllAgentPermissionRequests);
router.post('/agent-permissions/review', protect, checkPermission('agents.manage'), handleAgentPermissionRequest);

// Access Logs
router.get("/access-logs", protect, checkRole('superAdmin'), getAllAccessLogs);
router.get("/access-logs/me", protect, checkRole('admin', 'superAdmin'), getMyLogs);


router.put("/edit/restaurant/:restaurantId",checkRole('admin', 'superAdmin'),updateRestaurant)


module.exports = router;

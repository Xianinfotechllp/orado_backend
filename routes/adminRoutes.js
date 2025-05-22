const express = require("express");
const router = express.Router();
const { adminLogin, getPendingAgentRequests, approveAgentApplication, getPendingMerchants, updateMerchantStatus, logoutAdmin, logoutAll , getPendingChangeRequests, getPermissions, updatePermissions, reviewChangeRequest} = require("../controllers/adminController");
const {protect, checkRole, checkPermission} = require('../middlewares/authMiddleware')

router.post("/login", adminLogin);
router.post("/logout", protect, checkRole('admin', 'superAdmin'), logoutAdmin);
router.post("/logout-all", protect, checkRole('admin', 'superAdmin'), logoutAll);

//  requests for agent approval
router.get("/agent-requests", protect, checkRole('admin', 'superAdmin'), getPendingAgentRequests);
router.post("/agent-application/:userId/approve", protect, checkRole('admin', 'superAdmin'), approveAgentApplication);

// requests for merchant approval
router.get("/merchant-requests", protect, checkRole('admin', 'superAdmin'), getPendingMerchants);
router.post("/merchant-application/:userId/update", protect, checkRole('admin', 'superAdmin'), updateMerchantStatus);

// Permissions
router.get('/permissions/:restaurantId', protect, getPermissions);
router.put('/permissions/:restaurantId', protect, updatePermissions);
router.get('/change-requests/pending', protect, getPendingChangeRequests);
router.post('/change-requests/:requestId/review', protect, reviewChangeRequest);


module.exports = router;

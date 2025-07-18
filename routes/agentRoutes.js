const express = require('express')
const router = express.Router()
const { registerAgent,loginAgent, agentUpdatesOrderStatus, toggleAvailability, getAgentReviews, updateAgentBankDetails, logoutAgent, requestPermission,
   activateUnlockedPermissions, getAgentEarnings, getMyPermissionRequests, handleAgentResponse,
   getAgentAvailabilityStatus,
   addOrUpdateAgentDeviceInfo,
   getAssignedOrders
} = require("../controllers/agentController")
const { upload } = require('../middlewares/multer');
const { protect, checkRole, protectAgent } = require('../middlewares/authMiddleware');
const {forgotPassword, resetPassword} = require('../controllers/userControllers')


router.post(
  "/register",
  upload.fields([
    { name: "license", maxCount: 1 },
    { name: "insurance", maxCount: 1 },
    { name: "profilePicture", maxCount: 1 },
    { name: "rcBook", maxCount: 1 },             // ✅ new
    { name: "pollutionCertificate", maxCount: 1 } // ✅ new
  ]),
  registerAgent
);
router.post("/login",loginAgent)
router.post("/forgot-password", protect, checkRole('agent'), forgotPassword)
router.post("/reset-password/:token", protect, checkRole('agent'), resetPassword)
router.post("/logout", protect, checkRole('agent'), logoutAgent)

// add/update bank details
router.put("/bank-details", protect, checkRole('agent'), updateAgentBankDetails);

// availability
router.put('/:agentId/availability',toggleAvailability);
router.get('/:agentId/availability', getAgentAvailabilityStatus);
// delivery routes



// agent reviews
router.get("/:agentId/reviews", getAgentReviews);

// agent accepts or rejects an order
router.post("/orders/response", protect, checkRole('agent'), handleAgentResponse)

// router.put("/:agentId/orders/:orderId/status",protect, checkRole('agent'), agentUpdatesOrderStatus)
router.put("/:agentId/orders/:orderId/status", agentUpdatesOrderStatus)


// request permission
router.post("/request-permission", protect, checkRole('agent'), requestPermission);

// get agent permission requests
router.get("/my-permission-requests", protect, checkRole('agent'), getMyPermissionRequests);

// activate unlocked permissions
router.post('/activate-unlocked-perks', protect, checkRole('agent'), activateUnlockedPermissions);


//get agent earnigs
router.get("/agent-earnings/:agentId", protectAgent, checkRole('agent'), getAgentEarnings)
router.post('/device-info', addOrUpdateAgentDeviceInfo);

    
//get assinged routes

router.get("/assigned-orders",protectAgent,getAssignedOrders);
module.exports = router;

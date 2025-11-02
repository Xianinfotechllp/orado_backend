const express = require('express')
const router = express.Router()
const { registerAgent,loginAgent, agentUpdatesOrderStatus, toggleAvailability, getAgentReviews, updateAgentBankDetails, logoutAgent, requestPermission,
   activateUnlockedPermissions, getAgentEarnings, getMyPermissionRequests, handleAgentResponse,
   getAgentAvailabilityStatus,
   addOrUpdateAgentDeviceInfo,

 agentWarnings, agentTerminationInfo, applyLeave, getLeaveStatus,


   getAssignedOrders,
   getAssignedOrderDetails,
   agentAcceptOrRejectOrder,
   updateAgentDeliveryStatus,
   getAgentNotifications,deleteAgentNotification,
   markAgentNotificationAsRead,
   getAgentHomeData,
   getSelfieStatus,
   uploadSelfie,
   agentLogout,
   getAgentBasicDetails,
   getAgentEarningsSummary,
   getAgentIncentiveSummary,
   getCODDashboard,
   submitCOD,
   getCODHistory,
   getIncentivesForAgent
,getAgentMilestones,
    updateAgentLocation
} = require("../controllers/agentController")
const { upload } = require('../middlewares/multer');
const { protect, checkRole, protectAgent } = require('../middlewares/authMiddleware');
const {forgotPassword, resetPassword} = require('../controllers/userControllers');
const { saveFcmToken } = require('../controllers/admin/agentControllers');


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
router.post("/logout", protectAgent, agentLogout)

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

router.post("/save-fcm-token", saveFcmToken);
//get assinged routes

router.get("/assigned-orders",protectAgent,getAssignedOrders);


// warnings and termination
router.get("/warnings", protectAgent, agentWarnings);
router.get("/termination-info", protectAgent, agentTerminationInfo);

router.get("/assigned-orders/:orderId",protectAgent,getAssignedOrderDetails);

router.put("/agent-order-response/:orderId", protectAgent,agentAcceptOrRejectOrder);
router.put(
  "/agent-delivery-status/:orderId",
  protectAgent,
  updateAgentDeliveryStatus
);


router.get('/agent-notifications/:agentId',getAgentNotifications);
router.delete('/agent-notifications/:notificationId',deleteAgentNotification);
router.put('/mark-as-read/:notificationId',markAgentNotificationAsRead);

//home data
router.get('/home-data', protectAgent, getAgentHomeData)

//agent selfie 


// Agent leave management
router.post('/leave/apply', protectAgent, applyLeave);
router.get('/leave/status', protectAgent, getLeaveStatus);


router.post('/upload-selfie', protectAgent, upload.single('selfie'), uploadSelfie)
router.get('/selfie/status', protectAgent,getSelfieStatus)
router.get('/:agentId',protectAgent, getAgentBasicDetails)


router.get('/earning/summary',protectAgent, getAgentEarningsSummary);
router.get('/incentive/summary',protectAgent, getAgentIncentiveSummary);
router.get("/:agentId/incentive",protectAgent, getIncentivesForAgent);
router.get("/:agentId/milestones", protectAgent, getAgentMilestones);


router.get("/:agentId/cod-dashboard",protectAgent, getCODDashboard);
router.post("/:agentId/cod-submit", protectAgent, submitCOD);
router.get("/:agentId/cod-history", protectAgent, getCODHistory);




router.post("/:agentId/update-location", protectAgent, updateAgentLocation);
module.exports = router;

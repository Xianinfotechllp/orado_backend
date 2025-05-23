const express = require('express')
const router = express.Router()
const { registerAgent,loginAgent, agentAcceptsOrder,agentRejectsOrder, agentUpdatesOrderStatus, toggleAvailability, getAgentReviews, updateAgentBankDetails, logoutAgent, requestPermission, activateUnlockedPermissions
} = require("../controllers/agentController")
const { upload } = require('../middlewares/multer');
const { protect, checkRole } = require('../middlewares/authMiddleware');
const {forgotPassword, resetPassword} = require('../controllers/userControllers')


router.post(
  "/register",
  upload.fields([
    { name: "license", maxCount: 1 },
    { name: "insurance", maxCount: 1 },
    { name: "profilePicture", maxCount: 1 }
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
router.put('/:userId/availability', protect, checkRole('agent'), toggleAvailability);

// delivery routes



// agent reviews
router.get("/:agentId/reviews", getAgentReviews);

router.post('/orders/:orderId/accept',agentAcceptsOrder)
router.post("/orders/:orderId/accept",agentRejectsOrder)
router.put("/:agentId/orders/:orderId/status",agentUpdatesOrderStatus)

// request permission
router.post("/request-permission", protect, checkRole('agent'), requestPermission);

// get agent permission requests
router.get("/my-permission-requests", protect, checkRole('agent'), getMyPermissionRequests);

// activate unlocked permissions
router.post('/activate-unlocked-perks', protect, checkRole('agent'), activateUnlockedPermissions);






module.exports = router;

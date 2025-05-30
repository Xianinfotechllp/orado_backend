const express = require("express");
const router = express.Router();



const { registerUser, verifyOtp, loginUser,addAddress, deleteAddressById,editaddress, updateAddressById , resendOtp,forgotPassword ,resetPassword, logoutUser, logoutAll ,deleteUser ,getNotificationPrefs,updateNotificationPrefs} = require("../controllers/userControllers");



const bruteForcePrevent = require("../middlewares/bruteforcePrevent");

const {addAgentReview} = require('../controllers/agentController')
const {protect, checkRole} = require('../middlewares/authMiddleware')

// Routes
router.post("/register", registerUser);

router.post("/verify-otp",verifyOtp);

router.post("/resend-otp", resendOtp);
router.post("/login", loginUser);
router.post("/address", protect, checkRole('customer'), addAddress)
router.put("/address/:addressId", protect, checkRole('customer'), updateAddressById)
router.delete("/delete/:addressId ", protect, checkRole('customer'), deleteAddressById)

router.post("/forgot-password", protect, checkRole('customer'), forgotPassword)
router.post("/reset-password/:token", protect, checkRole('customer'), resetPassword)

router.post("/logout", protect, checkRole('customer'), logoutUser);
router.post("/logout-all", protect, checkRole('customer'), logoutAll);

// GDPR-delete
router.delete("/delete/:userId",deleteUser)



// post agent review
router.post("/:agentId/review", protect, checkRole('customer'), addAgentReview);

//notificaton prefs
router.get("/:userId/notifications/preferences",getNotificationPrefs)
router.put("/:userId/notifications/preferences",updateNotificationPrefs)


module.exports = router;

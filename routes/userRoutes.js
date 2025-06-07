const express = require("express");
const router = express.Router();




const { registerUser, verifyOtp, loginUser,addAddress, deleteAddressById,editaddress, deleteAccount, updateAddressById , resendOtp,forgotPassword ,resetPassword, logoutUser, logoutAll  ,getNotificationPrefs,updateNotificationPrefs,getaddress,markAsRead, getUserNotifications, markAllAsRead, updateUserProfile} = require("../controllers/userControllers");




const bruteForcePrevent = require("../middlewares/bruteforcePrevent");

const {addAgentReview} = require('../controllers/agentController')
const {protect, checkRole} = require('../middlewares/authMiddleware')

// Routes
router.post("/register", registerUser);

router.post("/verify-otp",verifyOtp);

router.post("/resend-otp", resendOtp);
router.post("/login", loginUser);
router.put("/update-profile", protect, updateUserProfile);

router.get("/adderss", protect, getaddress)
// router.post("/address", protect, checkRole('customer'), addAddress)
router.post("/address", protect, addAddress)
// router.put("/address/:addressId", protect, checkRole('customer'), updateAddressById)
router.put("/addresses/:addressId", protect, updateAddressById)

router.delete("/delete/:addressId", protect, deleteAddressById)

router.post("/forgot-password", protect, checkRole('customer'), forgotPassword)
router.post("/reset-password/:token", protect, checkRole('customer'), resetPassword)

router.post("/logout", protect, checkRole('customer'), logoutUser);
router.post("/logout-all", protect, checkRole('customer'), logoutAll);

// GDPR-delete
// router.delete("/delete/:userId",deleteUser)



// post agent review
router.post("/:agentId/review", protect, checkRole('customer'), addAgentReview);


//notificaton
router.get('/notifications', protect, getUserNotifications);
router.patch('/notifications/:id/read', protect, markAsRead);
router.patch('/notifications/mark-all-read', protect, markAllAsRead);


router.get("/notifications/preferences", protect, getNotificationPrefs)
router.put("/notifications/preferences/update", protect, updateNotificationPrefs)

// Delete Account
router.delete("/delete-account", protect, deleteAccount);



module.exports = router;

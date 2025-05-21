const express = require("express");
const router = express.Router();
const { registerUser, verifyOtp, loginUser,addAddress, deleteAddressById,deleteUser, updateAddressById , resendOtp,forgotPassword ,resetPassword} = require("../controllers/userControllers");
const bruteForcePrevent = require("../middlewares/bruteforcePrevent");
const {protectUser} = require('../middlewares/authMiddleware')
const {addAgentReview} = require('../controllers/agentController')

// Routes
router.post("/register", registerUser);

router.post("/verify-otp",verifyOtp);

router.post("/resend-otp", resendOtp);
router.post("/login", loginUser);
router.post("/address",addAddress)
router.put("/address/:addressId",updateAddressById)
router.delete("/delete/:addressId ",deleteAddressById)

router.post("/forgot-password",forgotPassword)
router.post("/reset-password/:token",resetPassword)

// GDPR-delete
router.delete("/delete/:userId",deleteUser)



// post agent review
router.post("/:agentId/review", protectUser, addAgentReview);


/// thsi new


module.exports = router;

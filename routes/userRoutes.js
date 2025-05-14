const express = require("express");
const router = express.Router();
const { registerUser, verifyOtp, loginUser,addAddress, deleteAddressById,editaddress, updateAddressById , resendOtp } = require("../controllers/userControllers");
const bruteForcePrevent = require("../middlewares/bruteforcePrevent");

// Routes
router.post("/register",bruteForcePrevent, registerUser);
router.post("/verify-otp",bruteForcePrevent, verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/login", bruteForcePrevent,loginUser);
router.post("/address",addAddress)
router.put("/address/:addressId",updateAddressById)
router.delete("/delete/:addressId ",deleteAddressById)
module.exports = router;

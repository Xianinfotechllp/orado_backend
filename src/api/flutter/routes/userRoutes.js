const express = require("express");
const router = express.Router();
const { registerUser, verifyOtp, loginUser,addAddress, deleteAddressById,editaddress, updateAddressById , resendOtp,forgotPassword ,resetPassword,verifyForgotPasswordOtp,sendLoginOtp,verifyLoginOtp,
     addFavouriteRestaurant,
    getFavouriteRestaurants,
    removeFavouriteRestaurant,
    getAddress,getUserDetails,
    updateUserDetails,
    saveCustomerToken,

           getUserLoyaltyBalance,
           getLoyaltyTransactionHistory,
           getPromoCodesForCustomerAndRestaurant
} = require("../controllers/userControllers");
const bruteForcePrevent = require("../middlewares/bruteforcePrevent");
const {verifyToken} = require("../middlewares/auth");
const {protect, checkRole} = require('../middlewares/authMiddleware')
// Routes
router.post("/register", registerUser);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/login", loginUser);

router.get("/profile", protect,getUserDetails);
router.put("/profile",protect,updateUserDetails)


router.post("/address",protect,addAddress)
router.put("/address/:addressId",protect,updateAddressById)
router.delete("/address/:addressId",protect,deleteAddressById)
router.get("/address",protect,getAddress)
router.post("/forgot-password",forgotPassword)
router.post("/forgot-password/verify-otp", verifyForgotPasswordOtp);
router.post("/reset-password",resetPassword)
router.post("/login-otp",sendLoginOtp)
router.post("/login-otp/verify",verifyLoginOtp)

//fav restaurants 
router.post("/fav/restaurants",protect,addFavouriteRestaurant)
router.get("/fav/restaurants",protect,getFavouriteRestaurants)
router.put('/fav/restaurants/remove',protect,removeFavouriteRestaurant);







router.get("/loyalty/balance", protect, getUserLoyaltyBalance)
router.get("/loyalty/history", protect, getLoyaltyTransactionHistory)

router.get("/promocodes/:restaurantId", protect,getPromoCodesForCustomerAndRestaurant);
router.post("/save-fcm-token",protect,saveCustomerToken)



module.exports = router;

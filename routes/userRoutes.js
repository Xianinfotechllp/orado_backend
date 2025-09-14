const express = require("express");
const router = express.Router();





const { registerUser, verifyOtp, loginUser,addAddress,getAddress ,deleteAddressById,editaddress, updateAddressById , resendOtp,forgotPassword ,resetPassword, logoutUser, logoutAll ,deleteUser ,getNotificationPrefs,updateNotificationPrefs,
      addFavouriteRestaurant,
    getFavouriteRestaurants,
    removeFavouriteRestaurant
       , getUserNotifications, markAllAsRead,markAsRead,deleteAccount, updateUserProfile,
       loginWithOtp,
       sendOtpToPhone,
       getUserLoyaltyBalance,
       getLoyaltyTransactionHistory,
       getPromoCodesForCustomerAndRestaurant
} = require("../controllers/userControllers");
const {initiateWalletTopUp, verifyAndCreditWallet, getWalletBalance, getUserWalletTransactions,razorpayWebhook,getTransactionStatusByOrderId} = require('../controllers/walletController')





const bruteForcePrevent = require("../middlewares/bruteforcePrevent");

const {addAgentReview} = require('../controllers/agentController')
const {protect, checkRole} = require('../middlewares/authMiddleware')

// // Routes
router.post("/register", registerUser);

router.post("/verify-otp",verifyOtp);

router.post("/resend-otp", resendOtp);
router.post("/login", loginUser);

router.put("/update-profile", protect, updateUserProfile);

router.get("/adderss", protect, getAddress)
router.post("/address", protect, checkRole('customer'), addAddress)
router.post("/address", protect, addAddress)
router.put("/address/:addressId", protect, checkRole('customer'), updateAddressById)
router.put("/addresses/:addressId", protect, updateAddressById)
router.post("/send-otp", sendOtpToPhone);               // Send phone OTP
router.post("/login-with-otp", loginWithOtp); 

router.delete("/delete/:addressId", protect, deleteAddressById)

router.post("/forgot-password", protect, checkRole('customer'), forgotPassword)
router.post("/reset-password/:token", protect, checkRole('customer'), resetPassword)

router.post("/logout", protect, checkRole('customer'), logoutUser);
router.post("/logout-all", protect, checkRole('customer'), logoutAll);

// // GDPR-delete
router.delete("/delete/:userId",deleteUser)



// // post agent review
router.post("/:agentId/review", protect, checkRole('customer'), addAgentReview);


router.get("/:userId/notifications/preferences",getNotificationPrefs)
router.put("/:userId/notifications/preferences",updateNotificationPrefs)


// //notificaton
router.get('/notifications', protect, getUserNotifications);
router.patch('/notifications/:id/read', protect, markAsRead);
router.patch('/notifications/mark-all-read', protect, markAllAsRead);


router.get("/notifications/preferences", protect, getNotificationPrefs)
router.put("/notifications/preferences/update", protect, updateNotificationPrefs)

// Delete Account
router.delete("/delete-account", protect, deleteAccount);



router.post("/fav/restaurants",protect,addFavouriteRestaurant)
router.get("/fav/restaurants",protect,getFavouriteRestaurants)
router.put('/fav/restaurants/remove',protect,removeFavouriteRestaurant);


// Wallet TopUp
router.post("/wallet/initiate", protect, initiateWalletTopUp)
router.post("/wallet/verify", protect, verifyAndCreditWallet)
router.get("/wallet/balance", protect, getWalletBalance)
router.get("/wallet/transactions", protect, getUserWalletTransactions);
router.get("/wallet/transactions/:orderId", protect, getTransactionStatusByOrderId)
router.post("/webhook/razorpay",express.raw({ type: "application/json" }),razorpayWebhook);




//loyality point

router.get("/loyalty/balance", protect, getUserLoyaltyBalance)
router.get("/loyalty/history", protect, getLoyaltyTransactionHistory)

router.get("/promocodes/:restaurantId", protect,getPromoCodesForCustomerAndRestaurant);



module.exports = router;

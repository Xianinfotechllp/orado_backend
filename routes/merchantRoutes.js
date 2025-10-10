const express = require('express');
const router = express.Router();
const admin = require('../config/firebaseAdmin');
const {registerMerchant,loginMerchant,getRestaurantsByOwner,getRestaurantApprovalStatus,changePassword, getOrdersByCustomer, getOrderDetails

    ,getMerchantOrders,updateOrderStatus,saveFcmToken,logoutMerchant
} = require("../controllers/merchantController")
const {createCategory} = require("../controllers/categoryController")
const {getAssignableOffers,createOfferByRestaurantOwner,getOffersForRestaurant,toggleOfferAssignment,
    updateOffer,deleteOffer
} = require("../controllers/offerController")
const {protect,checkRestaurantPermission} = require('../middlewares/authMiddleware');
const { getMerchantTaxesAndCharges } = require('../controllers/taxAndChargeController');
router.post("/register",registerMerchant)
router.post("/login",loginMerchant)
router.post("/change-password",protect,changePassword)


router.post("/save-token",protect,saveFcmToken)
router.post("/logout",protect,logoutMerchant)


router.get("/getmy-restaurants/:ownerId",protect,getRestaurantsByOwner)
router.get("/my-resturestaurant/:restaurantId/approve-status",protect,getRestaurantApprovalStatus)


//offer rotues for merchants
router.get("/offer/assignableOffers",protect,getAssignableOffers)

router.post("/restaurant/:restaurantId/offer",protect,checkRestaurantPermission('canManageOffers',false,"youd dont have permission to manage offers"),createOfferByRestaurantOwner)
router.put("/restaurant/:restaurantId/offe/:offerId",protect,checkRestaurantPermission('canManageOffers',false,"youd dont have permission to manage offers"), updateOffer)
router.delete("/restaurant/:restaurantId/offe/:offerId",protect,deleteOffer)


router.get("/restaurant/:restaurantId/offer",protect,getOffersForRestaurant)
router.put("/restaurants/:restaurantId/offer/:offerId",protect,toggleOfferAssignment)



router.get("/customer/:userId/orders-list",getOrdersByCustomer)


router.get("/order-details/:orderId",getOrderDetails)
router.get("/:merchantId/taxes",getMerchantTaxesAndCharges)

router.get("/orders",protect,getMerchantOrders)
router.patch("/orders",protect,updateOrderStatus)
router.get("/orders/:orderId",protect,getOrderDetails)



const merchantTokens = [
  
  
    "egH60zM-Q_ysKrmJSFlV6y:APA91bH5f3eBrLWh96eFFg1YuHv7HxySWVIvob3KxawKy7xn7-T792oexg4cRF_l70D0BFHD3tYpH8aIGP9uU1ZtLlFkn6ho28bzbtjK7XitwY4or9dLOas"
]


// Test route to send FCM notification
router.get('/send-test-notification', async (req, res) => {
  const { title, body, orderId } = req.query;

  if (!title || !body || !orderId) {
    return res.status(400).json({ error: 'Title, body, and orderId query parameters are required' });
  }

  const messages = merchantTokens.map(token => ({
    token,
    notification: { title, body },
    android: { notification: { sound: 'order_assignment' } },
    data: { click_action: 'FLUTTER_NOTIFICATION_CLICK', type: 'order_assignment', orderId },
  }));

  try {
    const responses = await Promise.allSettled(
      messages.map(msg => admin.messaging().send(msg)) // send individually
    );

    const failed = responses.filter(r => r.status === 'rejected');

    res.json({
      total: messages.length,
      success: messages.length - failed.length,
      failed: failed.length,
      errors: failed.map((f, i) => ({
        token: merchantTokens[i],
        reason: f.reason?.message || 'Unknown error',
      })),
    });
  } catch (err) {
    console.error('FCM Test Notification Error:', err);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});


module.exports = router;
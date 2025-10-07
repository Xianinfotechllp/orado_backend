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
  
    "eVIScXE6TkWe2RCCvP5bxt:APA91bHvTSXgGRhKW5GdXzA6By5kJrlIMVhbnIhUoeKeu763KOsAtszucuqd0jtD5ZyLkYu7P5QBRaoBJTDIc5JfMj2xjW2yQGenAfSADi1UVNdzmtZwKOo",
    "e6Mg86yGRDOJP2tWHdzFtn:APA91bF0EdE-mg08GScbhhso-gNjQR8AbzSir3wuOGGjBWy2xGeoV75UgxnXWMXJc_saq6v4pufp9o8ph7Wnded7nvg8p33S1GS4ASSl5lKpoB4j96jkdH0",
    "fSqA8xaPSsufLGg7TjHiOv:APA91bE9h6zAF7cAo11v6Kldm6gcnB6K3mp5gd0-uQDZ20pCYtl_VaYHhuggW7iLCrwimb5msGEi2aNU7NUEpogN53M5NxKDcyboaxBxP6LoeGTbez1NW98",
    "ehPz-dmDQe29vLPp250H54:APA91bGKaZa15hGNF72rnnoujIt4qAXWLgBIGSogxbAyD-dF99ySnCXr2RuKuHNg_h_XnPFNrGJOKJmN7SV2wn8d6p-7iwYFKkAKa1Gs-3LeB2k-j4FszTM",
    "drIhCUuzSryFLgUGUDY1Z3:APA91bFBwP6NU7jIqlEND1lV5nU6k9Ad873UgwfRlIk3I2nPEoq3R20geFY0ON_iByduW95M7ejV7rQR4kO3Vv19LcTv82Pz41jPbIXnwcBml-gVwMp7zYw",
    "foj3ZcXJTiKSm50Av0m7ZP:APA91bF9ybZIwLGrXvJEF2Y7uNnub0mfjjv9KDNMBnJ9iG_1WYQt3LLRgaZQx0OU1-r76o4jWyQSFrV29LX4JRDYBNDOL90Ap_JJbp3KTSMhZDvJqyyHKQI",
    "dNvt4ZtFTR6nwOH8u904on:APA91bHk4vBhMPppBmI8STSrl3Z6rapIvkTyGjn35stmyy1WwD3JqOhZOErhmGDohY8-C55yxRE8Uo2EtKTOUtI3KVIZj16voa9E4lFCIx-gbGgemhiSIw8",
    "f6EgYF3lT4Oyv6BNZc9rHO:APA91bHTAa-jiokqj73yFRnmbohiLfCdVuEBSMLMfi1UuOTeInpJegXbP9bMGioUpkfTVhi7oV5_6YMLamWGXa6TyeRt1Jc9lpp2CWmBR2swHnbrbkIeybM",
    "cwm4zrBTQ2egkXjLBFo_f-:APA91bFBqGTy2O9O39udOag21e1lh2UaAkzhCJSsqEjiC0klbNEkZQ-GgjU1nGR06FCOnkfPJOXiK97FseHwJkDpxR3O06WrTvRcI-fDXio2UbdvyJVontA",
    "fpq0rG2XSEqVGREH3ye6Nr:APA91bEp5mX_MSMe2e9N-l-HCoZOFuRGPr3TOEZNvBuLz18ZyLFsvZoCoCdVmQ4RNhvqtP0aFzsPVKeSl0PSmMu_yP_B2vC2HIIHbInl8JiqlkSlVQ2dV14",
    "ds2phqqfTzeA2_bjURIRuP:APA91bEwm8-b8smNizUlERyXmJ-LtYV6VMZJ0tI4vjSJvPJtjx9IQmXDL-dqYb6UVjI1s02-fQDxImwa_B-mnJtt0jquAKbNkbVppq5nd8VhEVV0TTysdaM",
    "eLzmY2HnQc2v9BeusH6GLO:APA91bE5a7XLyxku-vQV3JxtmgylruS1bYEphc65Orb9YVZcUyu-o3ikLE6vvjLxn3J4F7icgTXEl-ltCsW7msuCTom5oaiW9g1o9FHouCg10SbTlv5jadU",
    "f5_I58fwR9C5cGc39UqksD:APA91bHsvak7RltjFjP_lC-RwNkUTFbtWLlYh1NUUJFs4P2Jt8JqIbCvcXZYG8Cbc0T7vRle5LTx7qNXQ_Vyy-D_oUAQ-mAgVqX1ahavMy1ajB39IwT5LTo",
    "fUOz0YyPT2ypv5H8VCMKie:APA91bGPpPex-vsaA-RvboOcMjQOWymaF3j6pGHAbCEcBkayyzc3bq9SLMjQ-PqWhmhUfJpxeZgUaoBI30L0V3bJ_l8xJUNyecGasjL4Rhe0UjjKzc3JNoA"
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
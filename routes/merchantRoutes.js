const express = require('express');
const router = express.Router();

const {registerMerchant,loginMerchant,getRestaurantsByOwner,getRestaurantApprovalStatus,changePassword} = require("../controllers/merchantController")
const {createCategory} = require("../controllers/categoryController")
const {getAssignableOffers,createOfferByRestaurantOwner,getOffersForRestaurant,toggleOfferAssignment,
    updateOffer,deleteOffer
} = require("../controllers/offerController")
const {protect,checkRestaurantPermission} = require('../middlewares/authMiddleware')
router.post("/register",registerMerchant)
router.post("/login",loginMerchant)
router.post("/change-password",protect,changePassword)


router.get("/getmy-restaurants/:ownerId",protect,getRestaurantsByOwner)
router.get("/my-resturestaurant/:restaurantId/approve-status",protect,getRestaurantApprovalStatus)


//offer rotues for merchants
router.get("/offer/assignableOffers",protect,getAssignableOffers)

router.post("/restaurant/:restaurantId/offer",protect,checkRestaurantPermission('canManageOffers',false,"youd dont have permission to manage offers"),createOfferByRestaurantOwner)
router.put("/restaurant/:restaurantId/offe/:offerId",protect,checkRestaurantPermission('canManageOffers',false,"youd dont have permission to manage offers"), updateOffer)
router.delete("/restaurant/:restaurantId/offe/:offerId",protect,deleteOffer)


router.get("/restaurant/:restaurantId/offer",protect,getOffersForRestaurant)
router.put("/restaurants/:restaurantId/offer/:offerId",protect,toggleOfferAssignment)








module.exports = router;
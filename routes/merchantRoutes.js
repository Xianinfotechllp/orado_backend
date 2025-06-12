const express = require('express');
const router = express.Router();

const {registerMerchant,loginMerchant,getRestaurantsByOwner,getRestaurantApprovalStatus} = require("../controllers/merchantController")
const {createCategory} = require("../controllers/categoryController")
const {getAssignableOffers,createOfferByRestaurantOwner,getOffersForRestaurant} = require("../controllers/offerController")
const {protect} = require('../middlewares/authMiddleware')
router.post("/register",registerMerchant)
router.post("/login",loginMerchant)
router.get("/getmy-restaurants/:ownerId",protect,getRestaurantsByOwner)
router.get("/my-resturestaurant/:restaurantId/approve-status",protect,getRestaurantApprovalStatus)


//offer rotues for merchants
router.get("/offer/assignableOffers",protect,getAssignableOffers)

router.post("/restaurant/:restaurantId/offer",protect,createOfferByRestaurantOwner)
router.get("/restaurant/:restaurantId/offer",protect,getOffersForRestaurant)








module.exports = router;
const express = require('express');
const router = express.Router();

const {registerMerchant,loginMerchant,getRestaurantsByOwner,getRestaurantApprovalStatus} = require("../controllers/merchantController")
router.post("/register",registerMerchant)
router.post("/login",loginMerchant)
router.get("/getmy-restaurants/:ownerId",getRestaurantsByOwner)
router.get("/my-resturestaurant/:restaurantId/approve-status",getRestaurantApprovalStatus)




module.exports = router;
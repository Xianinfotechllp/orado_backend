const express = require('express');
const router = express.Router();

const {registerMerchant,loginMerchant,getRestaurantsByOwner,getRestaurantApprovalStatus} = require("../controllers/merchantController")
const {createCategory} = require("../controllers/categoryController")
const {protect} = require('../middlewares/authMiddleware')
router.post("/register",registerMerchant)
router.post("/login",loginMerchant)
router.get("/getmy-restaurants/:ownerId",protect,getRestaurantsByOwner)
router.get("/my-resturestaurant/:restaurantId/approve-status",protect,getRestaurantApprovalStatus)









module.exports = router;
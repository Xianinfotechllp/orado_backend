const express = require('express');
const router = express.Router();
const {getRestaurantsInServiceArea,getNearbyCategories,getRestaurantsByLocationAndCategory,getRecommendedRestaurants,getNearbyProducts} = require('../controllers/locationControllers')
router.get("/nearby-restaurants",getRestaurantsInServiceArea)
router.get("/nearby-categories",getNearbyCategories)
router.get("/nearby-restaurants/category/:categoryId",getRestaurantsByLocationAndCategory)
router.get("/nearby-restaurants/recommended", getRecommendedRestaurants);
router.get("/nearby-products",getNearbyProducts)
module.exports = router;
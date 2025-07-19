const express = require('express');
const router = express.Router();
const {getRestaurantsInServiceArea,getNearbyCategories,getRestaurantsByLocationAndCategory,getRecommendedRestaurants,getNearbyProducts,searchRestaurants, getNearbyGroceryStores} = require('../controllers/locationControllers')
router.get("/nearby-restaurants",getRestaurantsInServiceArea)
router.get("/nearby-categories",getNearbyCategories)
router.get("/nearby-restaurants/category/:categoryName",getRestaurantsByLocationAndCategory)
router.get("/nearby-restaurants/recommended", getRecommendedRestaurants);
router.get("/nearby-products",getNearbyProducts)
router.get("/nearby/restaurants/search",searchRestaurants)
router.get("/nearby-grocery",getNearbyGroceryStores)

module.exports = router;
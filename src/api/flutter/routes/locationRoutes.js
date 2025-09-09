const express = require('express');
const router = express.Router();
const {getNearbyRestaurants,getNearbyCategories,getNearbyCategoriesMock,getRecommendedRestaurants} = require('../controllers/locationControllers')

const {getNearbyStores} = require("../../../../controllers/locationControllers")
                                   
router.get("/nearby-restaurants",getNearbyRestaurants)
router.get("/nearby-categories",getNearbyCategoriesMock)
router.get("/nearby-restaurants/recommended", getRecommendedRestaurants);
router.get("/nearby-stores",getNearbyStores)
module.exports = router;
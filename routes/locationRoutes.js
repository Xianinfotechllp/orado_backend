const express = require('express');
const router = express.Router();
const {getNearbyRestaurants} = require('../controllers/locationControllers')
router.get("/nearby-restaurants",getNearbyRestaurants)
module.exports = router;
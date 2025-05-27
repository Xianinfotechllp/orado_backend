const express = require('express');
const router = express.Router();
const {getRestaurantsInServiceArea} = require('../controllers/locationControllers')
router.get("/nearby-restaurants",getRestaurantsInServiceArea)
// router.get("/nearby-categories")
module.exports = router;
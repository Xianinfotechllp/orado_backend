const express = require('express');
const router = express.Router();
const {getRestaurantsInServiceArea} = require('../controllers/locationControllers')
router.get("/nearby-restaurants",getRestaurantsInServiceArea)
module.exports = router;
const express = require('express')
const  {addCity, getCities, getAllCities, createCity} = require("../controllers/cityController")
const { getDeliveryFeeSettings, getCityDeliveryFeeSettings, createCityDeliveryFeeSetting, getSingleCityDeliveryFeeSetting, createOrUpdateCityDeliveryFeeSetting } = require('../controllers/admin/taxAndFeeSettingController')
const router = express.Router()
router.post("/cities", createCity)
router.get("/cities",getCities)

router.get("/city-delivery-fee-settings",getSingleCityDeliveryFeeSetting)
router.post("/city-delivery-fee-settings",createOrUpdateCityDeliveryFeeSetting);
module.exports = router
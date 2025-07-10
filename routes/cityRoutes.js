const express = require('express')
const  {addCity, getCities, getAllCities, createCity,toggleCityStatus,deleteCity,updateCity} = require("../controllers/cityController")
const { getDeliveryFeeSettings, getCityDeliveryFeeSettings, createCityDeliveryFeeSetting, getSingleCityDeliveryFeeSetting, createOrUpdateCityDeliveryFeeSetting } = require('../controllers/admin/taxAndFeeSettingController')
const router = express.Router()
router.post("/cities", createCity)
router.get("/cities",getCities)
router.patch("/cities/:id/status", toggleCityStatus);
router.delete("/cities/:id", deleteCity);

router.patch("/cities/:id", updateCity);

router.get("/city-delivery-fee-settings",getSingleCityDeliveryFeeSetting)
router.post("/city-delivery-fee-settings",createOrUpdateCityDeliveryFeeSetting);
module.exports = router
const express = require('express')
const  {addCity, getCities} = require("../controllers/cityController")
const router = express.Router()
router.post("/cities", addCity)
router.get("/cities",getCities)
module.exports = router
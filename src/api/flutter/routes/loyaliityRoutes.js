const express = require('express');
const {  getLoyaltySettings } = require('../controllers/loyalityControllers');
const router = express.Router();

router.get("/",getLoyaltySettings)

module.exports = router;
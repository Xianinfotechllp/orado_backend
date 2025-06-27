const express = require('express');
const { createOrUpdateLoyaltySettings, getLoyaltySettings } = require('../controllers/loyalityControllers');
const router = express.Router();


router.post("/",createOrUpdateLoyaltySettings)
router.get("/",getLoyaltySettings)

module.exports = router;
const express = require('express');
const router = express.Router();
const {registerMerchant,loginMerchant} = require("../controllers/merchantController")
router.post("/register",registerMerchant)
router.post("/login",loginMerchant)



module.exports = router;
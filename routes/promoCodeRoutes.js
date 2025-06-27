const express = require("express");
const router = express.Router();

const{createPromo,getAllPromos, updatePromo, deletePromo} = require("../controllers/promoCodeController");

// Create promo code
router.post("/", createPromo);
router.get("/",getAllPromos)
router.put("/:promoId",updatePromo)
router.delete("/:promoId",deletePromo)




module.exports = router;
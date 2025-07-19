const express = require("express");
const router = express.Router();

const{createPromoCode,getAllPromoCodes, updatePromoCode, togglePromoCodeStatus,deletePromoCode, } = require("../controllers/promoCodeController");

// Create promo code
router.post("/", createPromoCode);
router.get("/",getAllPromoCodes)
router.put("/:promoId",updatePromoCode)

router.patch("/:promoId/toggle", togglePromoCodeStatus)
router.delete("/:promoId",deletePromoCode)




module.exports = router;
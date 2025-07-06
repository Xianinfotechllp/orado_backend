const express = require("express");
const { createReferralPromotion, updateReferralPromotion, createOrUpdateReferralPromotion, getReferralPromotionSettings } = require("../controllers/admin/ referralPromotionController");
const router = express.Router();

router.post("/referral-promotions", createOrUpdateReferralPromotion);
// router.put("/referral-promotions/:id", updateReferralPromotion);

router.get("/referral-promotions",getReferralPromotionSettings);


// router.get("/referral-promotions", listReferralPromotions);
// router.get("/referral-promotions/:id", getReferralPromotion);
// router.delete("/referral-promotions/:id", deleteReferralPromotion);
module.exports = router;
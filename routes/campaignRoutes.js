const express = require("express");
const { createCampaign } = require("../controllers/CampaignControllers");
const { protect } = require("../middlewares/authMiddleware");
const router = express.Router();
router.post("/",protect,createCampaign)
module.exports = router;

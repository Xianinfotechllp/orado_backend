const express = require("express");
const router = express.Router();
const commissionController = require("../controllers/CommissionController");

// POST: Save / Update Commission Settings
router.post("/settings", commissionController.createOrUpdateCommissionSetting);

// GET: Get Commission Settings
router.get("/settings", commissionController.getCommissionSettings);
router.delete("/settings/:settingId", commissionController.deleteCommissionSetting);


module.exports = router;

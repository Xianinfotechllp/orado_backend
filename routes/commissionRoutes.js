const express = require("express");
const router = express.Router();
const commissionController = require("../controllers/CommissionController");

// POST: Save / Update Commission Settings
router.post("/settings", commissionController.createOrUpdateCommissionSetting);

// GET: Get Commission Settings
router.get("/settings", commissionController.getCommissionSettings);
router.delete("/settings/:settingId", commissionController.deleteCommissionSetting);
router.get("/summary",commissionController.getRestaurantCommissionsAdmin)
router.get("/summary/export-excel",commissionController.exportRestaurantCommissionsExcel)


module.exports = router 

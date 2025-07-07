const express = require("express");
const router = express.Router();
const commissionController = require("../controllers/CommissionController");

// POST: Save / Update Commission Settings
router.post("/settings", commissionController.saveCommissionSettings);

// GET: Get Commission Settings
router.get("/settings", commissionController.getCommissionSettings);

module.exports = router;

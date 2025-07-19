const express = require("express");
const router = express.Router();
const {
  createTaxAndCharge,
  getAllTaxAndCharges,
  deleteTaxOrCharge,
  toggleTaxOrChargeStatus,
  updateTaxOrCharge
} = require("../controllers/taxAndChargeController");

// Create new tax/charge
router.post("/", createTaxAndCharge);

router.patch("/:id", updateTaxOrCharge);

// Get all tax/charges
router.get("/", getAllTaxAndCharges);

// Delete tax/charge by ID
router.delete("/:id", deleteTaxOrCharge);

// Toggle tax/charge status (active/inactive)
router.patch("/:id/toggle", toggleTaxOrChargeStatus);

module.exports = router;

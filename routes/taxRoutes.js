const express = require("express");
const router = express.Router();
const taxController = require("../controllers/admin/taxController");

router.post("/", taxController.createTax);
router.get("/", taxController.getTaxes);
router.get("/:id", taxController.getTaxById);
router.put("/:id", taxController.updateTax);
router.delete("/:id", taxController.deleteTax);
router.put("/toggle/:id", taxController.toggleTaxStatus);
module.exports = router;

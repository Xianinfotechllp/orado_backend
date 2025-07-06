const express = require("express");
const router = express.Router();
const terminologyController = require("..//controllers/terminologyController");
// const { verifyAdminToken } = require("../middlewares/authMiddleware");  // assuming your token middleware is here

// ✅ Create or Update full terminology for a language
router.post("/",terminologyController.createOrUpdateTerminology);

// ✅ Get full terminology by language

router.get("/:language",  terminologyController.getTerminologyByLanguage);

// ✅ List all available languages
router.get("/",  terminologyController.listAllLanguages);

// ✅ Delete terminology for a language
router.delete("/:language",  terminologyController.deleteTerminology);

// ✅ Update a single term value within a language
router.patch("/:language/:key",  terminologyController.updateSingleTerm);

// ✅ Get a single term value by language and key
router.get("/:language/:key",  terminologyController.getSingleTerm);

module.exports = router;

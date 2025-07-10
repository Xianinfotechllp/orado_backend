const express = require("express");
const router = express.Router();
const templateController = require("../controllers/templateController");
router.post("/", templateController.createTemplate);
router.put("/", templateController.updateTemplate);


router.get("/", templateController.getAllTemplates);

// Get template by ID
router.get("/:templateId", templateController.getTemplateById);





module.exports = router;
const express = require("express");
const router = express.Router();
const globalOrderSettingsController = require("../controllers/globalOrderSettingsController");

router.post("/", globalOrderSettingsController.createOrUpdateGlobalSettings);
router.get("/", globalOrderSettingsController.getGlobalSettings);

module.exports = router;

const express = require("express");
const router = express.Router();

const preferencesController = require("../controllers/preferencesController");

// 📌 Get current preferences (singleton)
router.get("/", preferencesController.getPreferences);

// 📌 Create or Update preferences
router.post("/", preferencesController.createOrUpdatePreferences);

// 📌 Add a new user tag
router.post("/user-tags", preferencesController.addUserTag);

// 📌 Remove a user tag by ID
router.delete("/user-tags/:tagId", preferencesController.removeUserTag);

module.exports = router;

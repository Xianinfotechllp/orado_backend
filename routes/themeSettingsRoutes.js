const express = require("express");
const { protect, checkRole } = require("../middlewares/authMiddleware");
const {
  createOrUpdateThemeSettings,
  getThemeSettings,
} = require("../controllers/themeSettingsController");

const router = express.Router();

// ✅ Get current logged-in user's theme settings
router.get("/my-theme", protect, getThemeSettings);

// ✅ Create or update theme settings for current user
router.post("/my-theme", protect, createOrUpdateThemeSettings);

// ✅ Admin-only theme management for other users
router.post(
  "/:userId",
  protect,
  checkRole("admin", "superAdmin"),
  createOrUpdateThemeSettings
);

router.get(
  "/:userId",
  protect,
  checkRole("admin", "superAdmin"),
  getThemeSettings
);

module.exports = router;

const express = require("express");
const router = express.Router();
const {
  createOrUpdateGlobalDeliverySettings,
  getGlobalDeliverySettings
} = require("../controllers/admin/deliveySettingControllers");

router.post("/", createOrUpdateGlobalDeliverySettings);
router.get("/", getGlobalDeliverySettings);

module.exports = router;

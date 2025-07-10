const express = require("express");
const router = express.Router();

const {
  createOrUpdateGlobalOrderSettings,

} = require("../controllers/orderSettingController");

router.post("/", createOrUpdateGlobalOrderSettings);
// router.get("/", getGlobalOrderSettings);



module.exports = router;
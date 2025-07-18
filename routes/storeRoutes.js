const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { checkRole} = require("../middlewares/authMiddleware");
const {upload} = require("../middlewares/multer");

const {
  createStore,
 
} = require("../controllers/storeController");
const { getNearbyStores } = require("../controllers/locationControllers");
router.post(
  "/register",
  protect,
  checkRole("admin", "merchant"),
  upload.fields([
    { name: "images", maxCount: 5 },
    { name: "fssaiDoc", maxCount: 1 },
    { name: "gstDoc", maxCount: 1 },
    { name: "aadharDoc", maxCount: 1 },
  ]),
  createStore
);

router.get("/nearby", getNearbyStores);
module.exports = router;
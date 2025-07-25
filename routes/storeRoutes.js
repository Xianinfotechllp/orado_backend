const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { checkRole} = require("../middlewares/authMiddleware");
const {upload} = require("../middlewares/multer");

const {
  createStore,
  storeProduct,
  updateProduct,
  createCategory,

  updateCategory,
  toggleProductStatus,
  deleteProduct
 
} = require("../controllers/storeController");

const { getNearbyStores, getStoreById } = require("../controllers/locationControllers");
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
router.get("/:id", getStoreById);

router.post("/product",upload.array('images', 5),storeProduct);
router.patch("/product/:id", upload.array("images", 5), updateProduct);
router.patch('/product/:productId/toggle-status', toggleProductStatus);
router.delete('/product/:productId', deleteProduct);

// Create a new category
router.post("/category", upload.array("images", 5), createCategory);

// Update an existing category
router.patch("/category/:id", upload.array("images", 5), updateCategory);



module.exports = router;
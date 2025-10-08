const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { checkRole} = require("../middlewares/authMiddleware");
const {upload } = require("../middlewares/multer");
const {excelUpload} = require("../middlewares/excelUpload")

const {
  createStore,
  storeProduct,
  updateProduct,
  createCategory,createMerchantAndStore,

  updateCategory,
  toggleProductStatus,
  deleteProduct
 ,deleteCategory
 ,downloadCategoryTemplate,
 importCategories,
 exportCategories,
 bulkEditCategories,
 exportProducts,
 bulkEditProducts,getCategoriesByStore
 ,getProductsByStore,
 getCategoriesWithProducts,
 createCategoryWithStore
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


router.post(
  "/create-merchant-and-store",
  protect,
  checkRole("admin"), // only admin can create merchant + store
  upload.fields([
    { name: "images", maxCount: 5 },
    { name: "fssaiDoc", maxCount: 1 },
    { name: "gstDoc", maxCount: 1 },
    { name: "aadharDoc", maxCount: 1 },
  ]),
  createMerchantAndStore
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
router.delete("/category/:id", deleteCategory);
router.get("/category/download-template", downloadCategoryTemplate);
router.get("/:restaurantId/category/export",exportCategories)
router.post("/category/import/:restaurantId", excelUpload.single("file"),importCategories);
router.post("/:restaurantId/category/bulk-edit", excelUpload.single("file"),bulkEditCategories);
   

router.get("/:restaurantId/products/export",exportProducts)
router.post("/:restaurantId/products/bulk-edit",excelUpload.single("file"),bulkEditProducts)







router.get("/:storeId/categories", getCategoriesByStore);
router.post("/:storeId/categories", upload.array("images", 5), createCategoryWithStore);

// ================= Products =================
router.get("/:storeId/products", getProductsByStore);

router.get("/:storeId/categories-products",getCategoriesWithProducts)

module.exports = router;
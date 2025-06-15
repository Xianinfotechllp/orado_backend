const express = require("express");
const router  = express.Router()
const {createShop,editShop,getNearbyShops,getProductsForShop}  = require("../controllers/shopController")
router.post("/create",createShop)
router.put("/edit/:shopId",editShop)
router.get("/neraby",getNearbyShops)
router.get("/:shopId/products", getProductsForShop);
module.exports  = router
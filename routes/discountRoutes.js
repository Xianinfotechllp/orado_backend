const express = require("express");
const router = express.Router();
const discountController = require("../controllers/discountController");

// 📦 Restaurant-wide discounts
router.post("/restaurant", discountController.createRestaurantDiscount);
router.get("/restaurant/:restaurantId", discountController.getRestaurantDiscounts);

// 📦 Product-specific discounts
router.post("/product", discountController.createProductDiscount);
router.get("/product/:productId", discountController.getProductDiscounts);

module.exports = router;

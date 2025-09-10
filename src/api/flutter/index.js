const express = require("express");
const router = express.Router();

// Import route handlers
const userRouter = require("./routes/userRoutes");
const productRouter = require("./routes/productRoutesRoutes");
const restaurantRouter = require("./routes/restaurantRoutes");
const locationRouter = require("./routes/locationRoutes");
const agentRouter = require("./routes/agentRoutes");
const offerRouter = require("./routes/offerRoutes");
const orderRouter = require("./routes/orderRoutes");
const couponRoutes = require("./routes/couponRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const cartRoutes = require("./routes/cartRoutes");
const loyalityRoutes = require("./routes/loyaliityRoutes");
const TicketRouter = require("./routes/ticketRoutes");
const  storeRoutes = require("../../../routes/storeRoutes");
// Dummy test da  ta
const dummyCategories = [
  {
    categoryName: "Fruits",
    categoryId: 1,
    categoryimagerelation: {
      imageName: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTjhcvIlF6I8UzQly7Qzkh2vAHtSGwbgq_XPg&s"
    },
    categoryrelation1: [
      {
        subCategoryId: 101,
        subcategoryName: "Apples",
        subcategoryImagerelation: {
          imageName: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSW-oteAACfNN68JU4E2egKJeaMrL8kdUQuuA&s"
        }
      },
      {
        subCategoryId: 102,
        subcategoryName: "Bananas",
        subcategoryImagerelation: {
          imageName: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT-E3j6WhT2uOrCGqZABI_m8E4fCXNMYdXhmA&s"
        }
      }
    ]
  },
  {
    categoryName: "Vegetables",
    categoryId: 2,
    categoryimagerelation: {
      imageName: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNULJ6YE0WsLqqBUs3ozHh6rkZDFAJlXzlFw&s"
    },
    categoryrelation1: [
      {
        subCategoryId: 201,
        subcategoryName: "Tomatoes",
        subcategoryImagerelation: {
          imageName: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSsTnN1VYHPxQDMCDKBZWs2mKGXT2bO9arKYfO3g9LjMvjLiuCoVNuCeEA&s"
        }
      },
      {
        subCategoryId: 202,
        subcategoryName: "Spinach",
        subcategoryImagerelation: {
          imageName: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSsTnN1VYHPxQDMCDKBZWs2mKGXT2bO9arKYfO3g9LjMvjLiuCoVNuCeEA&s"
        }
      }
    ]
  }
];

// Mount routes
router.use("/user", userRouter);
router.use("/restaurants", productRouter);
router.use("/restaurants", restaurantRouter);
router.use("/restaurants", offerRouter);
router.use("/order", orderRouter);
router.use("/coupon", couponRoutes);
router.use("/location", locationRouter);
router.use("/agent", agentRouter);
router.use("/feedback", feedbackRoutes);
router.use("/cart", cartRoutes);
router.use("/loyality", loyalityRoutes);
router.use("/tickets", TicketRouter);
router.use("/store",storeRoutes)
// Dummy test route

router.get("/test/categories", (req, res) => {
  res.status(200).json(dummyCategories);
});

router.get("/",(req,res) =>
{

  res.send("ping")
  
})

module.exports = router;

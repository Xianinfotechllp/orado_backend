const express = require('express')
const router = express.Router()
const {createCategory,getAResturantCategories,editResturantCategory,deleteResturantCategory} = require('../controllers/categoryController')
const {createRestaurant,updateRestaurant,deleteRestaurant,getRestaurantById, updateBusinessHours}  = require('../controllers/restaurantController')
// restaurant routes
router.post("/",createRestaurant)
router.put("/:restaurantId",updateRestaurant)
router.delete("/:restaurantId",deleteRestaurant)
router.get("/:restaurantId",getRestaurantById)
router.put("/:restaurantId/business-hours", updateBusinessHours)

// kyc


//categories routes
router.post("/:restaurantId/categories",createCategory)
router.get("/:restaurantId/categories",getAResturantCategories)
router.put('/categories/:categoryId',editResturantCategory)
router.delete('/categories/:categoryId',deleteResturantCategory)




module.exports = router
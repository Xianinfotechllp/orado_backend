const express = require('express')
const router = express.Router()
const {createCategory,getAResturantCategories,editResturantCategory,deleteResturantCategory} = require('../controllers/categoryController')

const {createRestaurant,updateRestaurant,deleteRestaurant,getRestaurantById, updateBusinessHours, addKyc, getKyc,addServiceArea}  = require('../controllers/restaurantController')
const {upload} = require('../middlewares/multer')


// restaurant routes
router.post("/", upload.array('images', 1), createRestaurant);
router.put("/:restaurantId", upload.array('images', 1), updateRestaurant);
router.delete("/:restaurantId",deleteRestaurant)
router.get("/:restaurantId",getRestaurantById)
router.put("/:restaurantId/business-hours", updateBusinessHours)




router.post('/:restaurantId/service-areas',addServiceArea)

// kyc
router.post('/:restaurantId/kyc', upload.array('documents'), addKyc);
router.get('/kyc/:restaurantId', getKyc);


//categories routes
router.post("/:restaurantId/categories", upload.single('images'), createCategory);
router.get("/:restaurantId/categories",getAResturantCategories)
router.put('/categories/:categoryId', upload.single('images'), editResturantCategory);
router.delete('/categories/:categoryId',deleteResturantCategory)




module.exports = router
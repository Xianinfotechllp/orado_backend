const express = require('express')
const router = express.Router()
const {createCategory,getAResturantCategories,editResturantCategory,deleteResturantCategory} = require('../controllers/categoryController')
const {registerMerchant, loginMerchant, logoutMerchant, logoutAll} = require('../controllers/merchantController')
const {protect, checkRole} = require('../middlewares/authMiddleware')

const {upload} = require('../middlewares/multer')



const {forgotPassword, resetPassword} = require('../controllers/userControllers')

// merchant login/register
router.post(
  "/register",
  upload.fields([
    { name: "aadhaarCard", maxCount: 1 },
    { name: "fssaiLicense", maxCount: 1 },
    { name: "gstCertificate", maxCount: 1 },
  ]),
  registerMerchant
);
router.post("/login", loginMerchant)
router.post("/forgot-password", protect, checkRole('merchant'), forgotPassword)
router.post("/reset-password/:token", protect, checkRole('merchant'), resetPassword)
router.post("/logout", protect, checkRole('merchant'), logoutMerchant)
router.post("/logout-all", protect, checkRole('merchant'), logoutAll)

const {createRestaurant,updateRestaurant,deleteRestaurant,getRestaurantById, updateBusinessHours,addServiceArea, addKyc, getKyc,getRestaurantMenu}  = require('../controllers/restaurantController')


// restaurant routes
router.post("/", upload.array('images', 1), protect, checkRole('merchant'), createRestaurant);
router.put("/:restaurantId", upload.array('images', 1), protect, checkRole('merchant'), updateRestaurant);
router.delete("/:restaurantId", protect, checkRole('merchant'), deleteRestaurant)
router.get("/:restaurantId", protect, checkRole('merchant'), getRestaurantById)
router.put("/:restaurantId/business-hours", protect, checkRole('merchant'), updateBusinessHours)




router.post('/:restaurantId/service-areas', protect, checkRole('merchant'), addServiceArea)

// kyc
router.post('/:restaurantId/kyc', upload.array('documents'), protect, checkRole('merchant'), addKyc);
router.get('/kyc/:restaurantId', protect, checkRole('merchant'), getKyc);


//categories routes
router.post("/:restaurantId/categories", upload.single('images'), protect, checkRole('merchant'), createCategory);
router.get("/:restaurantId/categories", protect, checkRole('merchant'), getAResturantCategories)
router.put('/categories/:categoryId', upload.single('images'), protect, checkRole('merchant'), editResturantCategory);
router.delete('/categories/:categoryId', protect, checkRole('merchant'), deleteResturantCategory)


//get restaurant menu

router.get("/:restaurantId/menu",getRestaurantMenu)


module.exports = router
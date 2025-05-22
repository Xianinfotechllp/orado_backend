const express = require('express');
const router = express.Router();
const {
  createOffer,
  updateOffer,
  deleteOffer,
  getRestaurantOffers,
  getPublicOffers
} = require('../controllers/offerController');
const { protect, checkRole, checkRestaurantPermission } = require('../middlewares/authMiddleware');
const { upload } = require('../middlewares/multer');

// Restaurant Offer CRUD
router.post('/:restaurantId/offers', protect, checkRole('merchant'), checkRestaurantPermission('canManageOffers', true), upload.single('file'), createOffer);
router.put('/:restaurantId/offers/:offerId', protect, checkRole('merchant'), checkRestaurantPermission('canManageOffers', true), updateOffer);
router.delete('/:restaurantId/offers/:offerId', protect, checkRole('merchant'), checkRestaurantPermission('canManageOffers', true), deleteOffer);

// Fetching Offers
router.get('/:restaurantId/offers', getRestaurantOffers);
router.get('/public/offers',  getPublicOffers); // optional public listing

module.exports = router;

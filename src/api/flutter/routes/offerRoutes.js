const express = require('express');
const router = express.Router();
const {
  createOffer,
  updateOffer,
  deleteOffer,
  getRestaurantOffers,
  getPublicOffers
} = require('../controllers/offerController');

// Restaurant Offer CRUD
router.post('/:restaurantId/offers', createOffer);
router.put('/:restaurantId/offers/:offerId', updateOffer);
router.delete('/:restaurantId/offers/:offerId', deleteOffer);

// Fetching Offers
router.get('/:restaurantId/offers', getRestaurantOffers);
router.get('/public/offers', getPublicOffers); // optional public listing

module.exports = router;

const express = require('express');
const router = express.Router();
const offerController = require('../controllers/offerandDiscountController');

// Create a new offer
router.post('/offers', offerController.createOffer);

// Update an offer
router.put('/offers/:offerId', offerController.updateOffer);

// Delete an offer (hard delete)
router.delete('/offers/:offerId', offerController.deleteOffer);

// Toggle offer active/inactive
router.patch('/offers/:offerId/toggle', offerController.toggleOfferStatus);

// Get all offers (with optional filters: restaurantId, productId, isActive)
router.get('/offers', offerController.getAllOffers);

// Get offer by ID
router.get('/offers/:offerId', offerController.getOfferById);

module.exports = router;
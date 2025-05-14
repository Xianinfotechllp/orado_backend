const express = require('express');
const { createOffer, updateOffer, deleteOffer } = require('../controllers/offerController');
const router = express.Router();

router.post('/:restaurantId/offers', createOffer);
router.put('/:restaurantId/offers/:offerId', updateOffer);
router.delete('/:restaurantId/offers/:offerId',deleteOffer);

module.exports = router;

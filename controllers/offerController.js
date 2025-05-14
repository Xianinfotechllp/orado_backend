const Offer = require('../models/offer');
const Restaurant = require('../models/restaurantModel');

exports.createOffer = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const offerData = req.body;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    const newOffer = await Offer.create(offerData);

    // Link offer to restaurant
    restaurant.offers.push(newOffer._id);
    await restaurant.save();

    res.status(201).json({ message: 'Offer created', offer: newOffer });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


exports.updateOffer = async (req, res) => {
  try {
    const { offerId, restaurantId } = req.params;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    if (!restaurant.offers.includes(offerId)) {
      return res.status(403).json({ message: 'Offer does not belong to this restaurant' });
    }

    const updatedOffer = await Offer.findByIdAndUpdate(offerId, req.body, {
      new: true,
      runValidators: true
    });

    if (!updatedOffer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    res.json({ message: 'Offer updated', offer: updatedOffer });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



exports.deleteOffer = async (req, res) => {
  try {
    const { restaurantId, offerId } = req.params;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    const offerIndex = restaurant.offers.findIndex(id => id.toString() === offerId);
    if (offerIndex === -1) {
      return res.status(404).json({ message: 'Offer not associated with this restaurant' });
    }

    // Remove offer reference
    restaurant.offers.splice(offerIndex, 1);
    await restaurant.save();

    // Delete actual offer
    await Offer.findByIdAndDelete(offerId);

    res.json({ message: 'Offer deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


const Offer = require('../models/offer');
const Restaurant = require('../models/restaurantModel');
const { uploadOnCloudinary } = require('../utils/cloudinary'); 
const fs = require('fs');

// Create Offer

exports.createOffer = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const {
      title,
      description,
      code,
      type,
      target,
      discountType,
      discountValue,
      startDate,
      endDate,
      minOrderAmount,
      maxDiscount,
      location
    } = req.body;

    // Validate required fields
    if (!title || !code || !type || !target || !discountType || discountValue === undefined || !startDate || !endDate) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (discountValue < 0) {
      return res.status(400).json({ message: 'Discount value must be non-negative' });
    }

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ message: 'startDate must be before endDate' });
    }

    if (!['percentage', 'fixed'].includes(discountType)) {
      return res.status(400).json({ message: 'Invalid discountType' });
    }

    const validTypes = ['flash', 'discount', 'coupon', 'custom'];
    const validTargets = ['all', 'specific_users', 'specific_merchants', 'location'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid offer type' });
    }
    if (!validTargets.includes(target)) {
      return res.status(400).json({ message: 'Invalid offer target' });
    }

    const existing = await Offer.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: 'Offer code already exists' });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    let imageUrl = "";
    if (req.file) {
      const result = await uploadOnCloudinary(req.file.path, 'offers');
      imageUrl = result.secure_url;

      // Clean up local file after upload
      fs.unlinkSync(req.file.path);
    }

    const offer = new Offer({
      title,
      description,
      code: code.toUpperCase(),
      type,
      target,
      discountType,
      discountValue,
      startDate,
      endDate,
      minOrderAmount: minOrderAmount || 0,
      maxDiscount: maxDiscount || 0,
      imageUrl,
      location
    });

    const newOffer = await offer.save();

    if (!Array.isArray(restaurant.offers)) {
      restaurant.offers = [];
    }
    restaurant.offers.push(newOffer._id);
    await restaurant.save();

    res.status(201).json({ message: 'Offer created successfully', offer: newOffer });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while creating offer', error: error.message });
  }
};


// Update Offer
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
    console.error(error);
    res.status(500).json({ message: 'Server error while updating offer', error: error.message });
  }
};

// Delete Offer
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

    restaurant.offers.splice(offerIndex, 1);
    await restaurant.save();

    await Offer.findByIdAndDelete(offerId);

    res.json({ message: 'Offer deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while deleting offer', error: error.message });
  }
};

// Get Offers for a Restaurant
exports.getRestaurantOffers = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const restaurant = await Restaurant.findById(restaurantId).populate('offers');
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    res.json({ offers: restaurant.offers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching offers', error: error.message });
  }
};

// Public Offers (optional)
exports.getPublicOffers = async (req, res) => {
  try {
    const currentDate = new Date();

    const offers = await Offer.find({
      active: true,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate },
      target: 'all'
    });

    res.json({ offers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching public offers', error: error.message });
  }
};

// controllers/offerController.js
const Offer = require('../models/offerModel');

exports.createOffer = async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      discountValue,
      maxDiscount,
      minOrderValue,
      applicableRestaurants,
      applicableProducts,
      applicableLevel,
      validFrom,
      validTill,
      isActive,
      createdBy,
      createdByRestaurant,
      usageLimitPerUser,
      totalUsageLimit,
      comboProducts,
      bogoDetails,
    } = req.body;

    // Basic validation
    if (!title || !type || !discountValue || !minOrderValue || !validFrom || !validTill || !createdBy || !applicableLevel) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // Conditional validation
    if (type === 'percentage' && !maxDiscount) {
      return res.status(400).json({ error: 'maxDiscount is required for percentage offer.' });
    }

    if (type === 'combo' && (!comboProducts || comboProducts.length === 0)) {
      return res.status(400).json({ error: 'comboProducts required for combo offer.' });
    }

    if (type === 'bogo' && (!bogoDetails || !bogoDetails.buyProduct || !bogoDetails.getProduct)) {
      return res.status(400).json({ error: 'bogoDetails required for BOGO offer.' });
    }

    // Create new offer
    const newOffer = new Offer({
      title,
      description,
      type,
      discountValue,
      maxDiscount,
      minOrderValue,
      applicableRestaurants,
      applicableProducts,
      applicableLevel,
      validFrom,
      validTill,
      isActive,
      createdBy,
      createdByRestaurant: createdBy === 'restaurant' ? createdByRestaurant : null,
      usageLimitPerUser,
      totalUsageLimit,
      comboProducts: type === 'combo' ? comboProducts : [],
      bogoDetails: type === 'bogo' ? bogoDetails : undefined,
    });

    await newOffer.save();

    return res.status(201).json({
      message: 'Offer created successfully',
      offer: newOffer,
    });
  } catch (err) {
    console.error('Error creating offer:', err);
    return res.status(500).json({ error: 'Server error while creating offer' });
  }
};




exports.updateOffer = async (req, res) => {
    try {
      const { offerId } = req.params;
      const updateData = req.body;
  
      if (!offerId) {
        return res.status(400).json({ message: 'Offer ID is required' });
      }
  
      const existingOffer = await Offer.findById(offerId);
      if (!existingOffer) {
        return res.status(404).json({ message: 'Offer not found' });
      }
  
      // Update only provided fields
      Object.keys(updateData).forEach((key) => {
        existingOffer[key] = updateData[key];
      });
  
      await existingOffer.save();
  
      return res.status(200).json({
        message: 'Offer updated successfully',
        data: existingOffer,
      });
    } catch (error) {
      console.error('Update Offer Error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  };
  exports.deleteOffer = async (req, res) => {
    try {
      const { offerId } = req.params;
  
      if (!offerId) {
        return res.status(400).json({ message: 'Offer ID is required' });
      }
  
      const deletedOffer = await Offer.findByIdAndDelete(offerId);
  
      if (!deletedOffer) {
        return res.status(404).json({ message: 'Offer not found' });
      }
  
      return res.status(200).json({
        message: 'Offer deleted successfully',
        data: deletedOffer,
      });
    } catch (error) {
      console.error('Delete Offer Error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  };
  exports.toggleOfferStatus = async (req, res) => {
    try {
      const { offerId } = req.params;
  
      if (!offerId) {
        return res.status(400).json({ message: 'Offer ID is required' });
      }
  
      const offer = await Offer.findById(offerId);
  
      if (!offer) {
        return res.status(404).json({ message: 'Offer not found' });
      }
  
      offer.isActive = !offer.isActive;
      await offer.save();
  
      return res.status(200).json({
        message: `Offer is now ${offer.isActive ? 'active' : 'inactive'}`,
        offer,
      });
    } catch (error) {
      console.error('Toggle Offer Status Error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  };
  exports.getAllOffers = async (req, res) => {
    try {
      const { restaurantId, productId, isActive } = req.query;
  
      const filter = {};
  
      if (restaurantId) {
        filter.applicableRestaurants = restaurantId;
      }
  
      if (productId) {
        filter.applicableProducts = productId;
      }
  
      if (isActive !== undefined) {
        filter.isActive = isActive === 'true';
      }
  
      const offers = await Offer.find(filter).sort({ createdAt: -1 });
  
      return res.status(200).json({
        message: 'Offers fetched successfully',
        offers,
      });
    } catch (error) {
      console.error('Get All Offers Error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  };
        


  exports.getOfferById = async (req, res) => {
    try {
      const { offerId } = req.params;
  
      const offer = await Offer.findById(offerId);
  
      if (!offer) {
        return res.status(404).json({ message: 'Offer not found' });
      }
  
      return res.status(200).json({
        message: 'Offer fetched successfully',
        offer,
      });
    } catch (error) {
      console.error('Get Offer By ID Error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  };
  
// controllers/offerController.js
const Offer = require('../models/offerModel');

exports.createOffer = async (req, res) => {
  try {
    const {
      title,
      description,
      type, // 'flat', 'percentage', 'combo', 'bogo'
      discountValue,
      maxDiscount,
      minOrderValue,
      applicableRestaurants,
      applicableProducts,
      applicableLevel, // 'product' or 'order'
      validFrom,
      validTill,
      isActive,
      createdBy, // 'admin' or 'restaurant'
      createdByRestaurant,
      usageLimitPerUser,
      totalUsageLimit,
      comboProducts,
      comboPrice,
      bogoDetails, // { buyProduct, getProduct, buyQty, getQty }
      priority
    } = req.body;

    // === Validate Basic Required Fields ===
    if (!title || !type || !validFrom || !validTill) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // === Validate Offer Dates ===
    if (new Date(validFrom) >= new Date(validTill)) {
      return res.status(400).json({ error: "validFrom must be before validTill." });
    }

    // === Validate Discount Value ===
    if (["flat", "percentage"].includes(type) && !discountValue) {
      return res.status(400).json({ error: "discountValue is required for flat or percentage offer." });
    }

    // === Type-Specific Validations ===
    switch (type) {
      case "percentage":
        if (!maxDiscount) {
          return res.status(400).json({ error: "maxDiscount is required for percentage offer." });
        }
        break;

      case "combo":
        if (!comboProducts || comboProducts.length < 2) {
          return res.status(400).json({ error: "At least 2 comboProducts are required for combo offer." });
        }
        if (!comboPrice) {
          return res.status(400).json({ error: "comboPrice is required for combo offer." });
        }
        break;

      case "bogo":
        if (
          !bogoDetails ||
          !bogoDetails.buyProduct ||
          !bogoDetails.getProduct ||
          !bogoDetails.buyQty ||
          !bogoDetails.getQty
        ) {
          return res.status(400).json({ error: "Complete bogoDetails are required for BOGO offer." });
        }
        break;
    }

    // === Prepare Offer Payload ===
    const offerData = {
      title,
      description,
      type,
      discountValue: ["flat", "percentage"].includes(type) ? discountValue : undefined,
      maxDiscount: type === "percentage" ? maxDiscount : undefined,
      minOrderValue,
      applicableRestaurants,
      applicableProducts,
      applicableLevel,
      validFrom,
      validTill,
      isActive,
      createdBy,
      createdByRestaurant: createdBy === "restaurant" ? createdByRestaurant : null,
      usageLimitPerUser,
      totalUsageLimit,
      priority: priority || 10,
      createdAt: new Date(),
    };

    if (type === "combo") {
      offerData.comboProducts = comboProducts;
      offerData.comboPrice = comboPrice;
    }

    if (type === "bogo") {
      offerData.bogoDetails = bogoDetails;
    }

    // === Save Offer ===
    const newOffer = new Offer(offerData);
    await newOffer.save();

    return res.status(201).json({
      message: "Offer created successfully",
      offer: newOffer,
    });
  } catch (err) {
    console.error("Error creating offer:", err);
    return res.status(500).json({ error: "Internal server error" });
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
  
const Offer = require("../models/offerModel");
const Restaurant = require("../models/restaurantModel");
const mongoose = require('mongoose')

// ✅ Create Offer - Admin Side (without applicableRestaurants, without code)
exports.createOffer = async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      discountValue,
      maxDiscount,
      minOrderValue,
      validFrom,
      validTill,
      usageLimitPerUser,
      totalUsageLimit
    } = req.body;

    // Validate required fields
    if (
      !title ||
      !type ||
      !discountValue ||
      !minOrderValue ||
      !validFrom ||
      !validTill
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate offer type
    if (!['flat', 'percentage'].includes(type)) {
      return res.status(400).json({ message: "Invalid offer type. Must be 'flat' or 'percentage'." });
    }

    // If type is 'percentage', maxDiscount is required
    if (type === 'percentage' && (!maxDiscount || maxDiscount <= 0)) {
      return res.status(400).json({ message: "maxDiscount is required for percentage offers." });
    }

    // Validate validFrom and validTill are valid dates
    const startDate = new Date(validFrom);
    const endDate = new Date(validTill);
    const now = new Date();

    if (isNaN(startDate) || isNaN(endDate)) {
      return res.status(400).json({ message: "Invalid date format for validFrom or validTill." });
    }

    if (startDate < now.setHours(0, 0, 0, 0)) {
      return res.status(400).json({ message: "validFrom date cannot be in the past." });
    }

    if (endDate <= startDate) {
      return res.status(400).json({ message: "validTill must be after validFrom." });
    }

    // Create new Offer
    const newOffer = await Offer.create({
      title,
      description,
      type,
      discountValue,
      maxDiscount: type === 'percentage' ? maxDiscount : null,
      minOrderValue,
      validFrom: startDate,
      validTill: endDate,
      isActive: true,
      createdBy: "admin",
      usageLimitPerUser:usageLimitPerUser,
      totalUsageLimit:totalUsageLimit,

    });

    res.status(201).json({
      message: "Offer created successfully.",
      offer: newOffer,
    });

  } catch (error) {
    console.error("Error creating offer:", error);
    res.status(500).json({ message: "Server error creating offer." });
  }
};

exports.getAllOffers = async (req, res) => {
  try {
    // Parse and validate query parameters
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const { restaurantId, isActive, type, search, status } = req.query;

    // Build query object
    const query = {};

    // Restaurant filter
    if (restaurantId) {
      if (Array.isArray(restaurantId)) {
        query.applicableRestaurants = { $in: restaurantId };
      } else {
        query.applicableRestaurants = restaurantId;
      }
    }

    // Simple isActive filter
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Offer type filter
    if (type) {
      query.type = { $in: Array.isArray(type) ? type : [type] };
    }

    // Status filter
    if (status) {
      const now = new Date();
      switch(status.toLowerCase()) {
        case 'active':
          query.startDate = { $lte: now };
          query.endDate = { $gte: now };
          break;
        case 'upcoming':
          query.startDate = { $gt: now };
          break;
        case 'expired':
          query.endDate = { $lt: now };
          break;
      }
    }

    // Search functionality
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { termsAndConditions: { $regex: search, $options: 'i' } }
      ];
    }

    // Get total count
    const totalCount = await Offer.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);
    const currentPage = page > totalPages && totalPages > 0 ? totalPages : page;

    // Fetch offers
    const offers = await Offer.find(query)
      .sort({ createdAt: -1 })
      .skip(totalPages > 0 ? (currentPage - 1) * limit : 0)
      .limit(limit)
      .populate({
        path: 'applicableRestaurants',
        select: '_id restaurantName location',
        options: { lean: true }
      })
      .lean();

    // Add status to each offer
    const now = new Date();
    offers.forEach(offer => {
      if (offer.startDate > now) {
        offer.status = 'upcoming';
      } else if (offer.endDate < now) {
        offer.status = 'expired';
      } else {
        offer.status = 'active';
      }
    });

    // Simplified response structure
    res.status(200).json({
      success: true,
      message: totalCount > 0 ? "Offers retrieved successfully" : "No offers found",
      offers,
      totalCount,
      currentPage,
      totalPages,
      itemsPerPage: limit,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1
    });

  } catch (error) {
    console.error("Admin offer fetch error:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false,
        message: "Invalid query parameters",
        error: error.message 
      });
    }

    res.status(500).json({ 
      success: false,
      message: "Server error while fetching offers",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



exports.getAssignableOffers = async (req, res) => {
  try {
    // ✅ Define current date at the start
    const currentDate = new Date();

    // ✅ Fetch public offers created by admin, active, and valid within date range
    const assignableOffers = await Offer.find({
      createdBy: 'admin',
      isActive: true,
      validFrom: { $lte: currentDate },
      validTill: { $gte: currentDate }
    }).sort({ discountValue: -1 });


    res.status(200).json({
      success: true,
      message: "Assignable offers retrieved successfully",
      offers: assignableOffers
    });

  } catch (error) {
    console.error("Error getting assignable offers:", error);
    res.status(500).json({
      success: false,
      message: "Server error getting assignable offers",
      error: error.message
    });
  }
};







// ✅ Assign an offer to one or multiple restaurants
exports.assignOfferToRestaurant = async (req, res) => {
  try {
    const { offerId, restaurantId } = req.body;

    if (!offerId || !restaurantId) {
      return res.status(400).json({
        success: false,
        message: "offerId and restaurantId are required.",
      });
    }

    // Validate offer existence
    const offer = await Offer.findById(offerId);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found.",
      });
    }

    // Check if restaurant already assigned
    if (offer.applicableRestaurants.includes(restaurantId)) {
      return res.status(400).json({
        success: false,
        message: "Offer already assigned to this restaurant.",
      });
    }

    // Add restaurantId to offer's applicableRestaurants
    offer.applicableRestaurants.push(restaurantId);
    await offer.save();

    res.status(200).json({
      success: true,
      message: "Offer assigned to restaurant successfully.",
      offer,
    });
  } catch (error) {
    console.error("Error assigning offer to restaurant:", error);
    res.status(500).json({
      success: false,
      message: "Server error while assigning offer.",
      error: error.message,
    });
  }
};




exports.createOfferByRestaurantOwner = async (req, res) => {
  try {

    const {restaurantId} = req.params
    const {
      title,
      description,
      type,
      discountValue,
      maxDiscount,
      minOrderValue,
      validFrom,
      validTill,
      usageLimitPerUser,
      totalUsageLimit,
    } = req.body;

    // Required fields validation
    if (
      !restaurantId ||
      !title ||
      !type ||
      !discountValue ||
      !minOrderValue ||
      !validFrom ||
      !validTill
    ) {
      return res.status(400).json({
        success: false,
        message:
          "restaurantId, title, type, discountValue, minOrderValue, validFrom, and validTill are required.",
      });
    }

    // Type validation
    if (!['flat', 'percentage'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "type must be either 'flat' or 'percentage'.",
      });
    }

    // Number validations
    if (isNaN(discountValue) || discountValue <= 0) {
      return res.status(400).json({
        success: false,
        message: "discountValue must be a positive number.",
      });
    }

    if (isNaN(minOrderValue) || minOrderValue <= 0) {
      return res.status(400).json({
        success: false,
        message: "minOrderValue must be a positive number.",
      });
    }

    if (type === 'percentage' && (isNaN(maxDiscount) || maxDiscount <= 0)) {
      return res.status(400).json({
        success: false,
        message:
          "maxDiscount must be a positive number when type is 'percentage'.",
      });
    }

    if (usageLimitPerUser && (isNaN(usageLimitPerUser) || usageLimitPerUser < 1)) {
      return res.status(400).json({
        success: false,
        message: "usageLimitPerUser must be a positive number if provided.",
      });
    }

    if (totalUsageLimit && (isNaN(totalUsageLimit) || totalUsageLimit < 1)) {
      return res.status(400).json({
        success: false,
        message: "totalUsageLimit must be a positive number if provided.",
      });
    }

    // Date validations
    const validFromDate = new Date(validFrom);
    const validTillDate = new Date(validTill);

    if (isNaN(validFromDate.getTime()) || isNaN(validTillDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "validFrom and validTill must be valid dates.",
      });
    }

    if (validFromDate >= validTillDate) {
      return res.status(400).json({
        success: false,
        message: "validFrom must be earlier than validTill.",
      });
    }

    // Create the offer
    const newOffer = new Offer({
      title,
      description,
      type,
      discountValue,
      maxDiscount: type === 'percentage' ? maxDiscount : undefined,
      minOrderValue,
      validFrom: validFromDate,
      validTill: validTillDate,
      createdBy: 'restaurant',
      createdByRestaurant: restaurantId,
      applicableRestaurants: [restaurantId],
      usageLimitPerUser,
      totalUsageLimit,
    });

    await newOffer.save();

    res.status(201).json({
      success: true,
      message: "Offer created successfully by restaurant owner.",
      offer: newOffer,
    });
  } catch (error) {
    console.error("Error creating offer by restaurant owner:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating offer.",
      error: error.message,
    });
  }
};



exports.getOffersForRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // Check if restaurantId is provided
    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        message: "restaurantId is required in the URL.",
      });
    }

    // Validate if restaurantId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid restaurantId format.",
      });
    }

    // Fetch offers where applicableRestaurants contains this restaurantId
    const offers = await Offer.find({ applicableRestaurants: restaurantId }).sort({
      validTill: -1,
    });

    if (offers.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No offers assigned to this restaurant yet.",
        total: 0,
        offers: [],
      });
    }

    res.status(200).json({
      success: true,
      message: "Offers assigned to restaurant fetched successfully.",
      total: offers.length,
      offers,
    });
  } catch (error) {
    console.error("Error fetching offers for restaurant:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching offers for restaurant.",
      error: error.message,
    });
  }
};
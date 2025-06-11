const Offer = require("../models/offerModel");
const Restaurant = require("../models/restaurantModel");


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
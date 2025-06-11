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
      usageLimitPerUser,
      totalUsageLimit
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

const PromoCode = require("../models/promoCodeModels")



exports.createPromo = async (req, res) => {
  try {
    const {
      language,
      promotionType,
      promotionName,
      discountValue,
      description,
      from,
      till,
      maximumDiscountValue,
      maximumNoOfAllowedUsers,
      minimumOrderAmount,
      applicationMode,
      isReusableBySameUser,
      allowLoyaltyRedeem,
      allowLoyaltyEarn,
      promoAppliedOn,
      applicableOrderNumbers,
      assignedRestaurants,
    } = req.body;
console.log(req.body)
    if (!["Percentage", "Flat"].includes(promotionType)) {
      return res.status(400).json({ success: false, message: "Invalid promotion type" });
    }
    // Validate required fields
    if (!promotionType || !promotionName || discountValue === undefined) {
      return res.status(400).json({
        success: false,
        message: "Promotion Type, Name, and Discount Value are required",
      });
    }
  

    if (discountValue < 0) {
      return res.status(400).json({ success: false, message: "Discount value cannot be negative" });
    }

    if (from && till && new Date(from) >= new Date(till)) {
      return res.status(400).json({ success: false, message: "'From' date must be before 'Till' date" });
    }

    if (description && description.length > 150) {
      return res.status(400).json({ success: false, message: "Description exceeds 150 characters" });
    }

    // Create promo
    const newPromo = await PromoCode.create({
      language,
      promotionType,
      promotionName: promotionName.trim(),
      discountValue,
      description,
      from,
      till,
      maximumDiscountValue,
      maximumNoOfAllowedUsers,
      minimumOrderAmount,
      applicationMode,
      isReusableBySameUser,
      allowLoyaltyRedeem,
      allowLoyaltyEarn,
      promoAppliedOn,
      applicableOrderNumbers,
      assignedRestaurants,
    });

    return res.status(201).json({
      success: true,
      message: "Promo code created successfully",
      data: newPromo,
    });
  } catch (error) {
    console.error("Error creating promo code:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while creating the promo",
    });
  }
};



exports.getAllPromos = async (req, res) => {
  try {
    // Query params
    const {
      page = 1,
      limit = 10,
      search = "",
      applicationMode,
    } = req.query;

    const query = {};

    // Search by promotionName (case insensitive)
    if (search) {
      query.promotionName = { $regex: search, $options: "i" };
    }

    // Filter by applicationMode if provided
    if (applicationMode) {
      query.applicationMode = applicationMode;
    }

    // Total count for pagination metadata
    const totalPromos = await PromoCode.countDocuments(query);

    // Fetch promos with pagination, sort latest first
    const promos = await PromoCode.find(query)
      .populate("assignedRestaurants", "restaurantName")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    return res.status(200).json({
      success: true,
      data: promos,
      pagination: {
        totalRecords: totalPromos,
        currentPage: Number(page),
        totalPages: Math.ceil(totalPromos / limit),
      },
    });

  } catch (error) {
    console.error("Error fetching promo codes:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch promo codes",
    });
  }
};

exports.updatePromo = async (req, res) => {
  try {
    const { promoId } = req.params;
    const updateData = req.body;

    const allowedFields = [
      "language",
      "promotionType",
      "promotionName",
      "discountValue",
      "description",
      "from",
      "till",
      "maximumDiscountValue",
      "maximumNoOfAllowedUsers",
      "minimumOrderAmount",
      "applicationMode",
      "isReusableBySameUser",
      "allowLoyaltyRedeem",
      "allowLoyaltyEarn",
      "promoAppliedOn",
      "applicableOrderNumbers",
      "assignedRestaurants",
      "active"  // if you want to toggle promo status
    ];

    // Filter updateData to only allowed fields
    const filteredUpdateData = {};
    for (const key in updateData) {
      if (allowedFields.includes(key)) {
        filteredUpdateData[key] = updateData[key];
      }
    }

    if (Object.keys(filteredUpdateData).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields provided for update." });
    }

    const updatedPromo = await PromoCode.findByIdAndUpdate(
      promoId,
      { $set: filteredUpdateData },
      { new: true }
    );

    if (!updatedPromo) {
      return res.status(404).json({ success: false, message: "Promo code not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Promo code updated successfully",
      data: updatedPromo,
    });

  } catch (error) {
    console.error("Error updating promo code:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update promo code",
    });
  }
};


exports.deletePromo = async (req, res) => {
  try {
    const { promoId } = req.params;

    const deletedPromo = await PromoCode.findByIdAndDelete(promoId);

    if (!deletedPromo) {
      return res.status(404).json({ success: false, message: "Promo code not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Promo code deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting promo code:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete promo code",
    });
  }
};


exports.togglePromoStatus = async (req, res) => {
  try {
    const { promoId } = req.params;

    const promo = await PromoCode.findById(promoId);

    if (!promo) {
      return res.status(404).json({ success: false, message: "Promo code not found" });
    }

    promo.isActive = !promo.isActive;
    await promo.save();

    return res.status(200).json({
      success: true,
      message: `Promo code has been ${promo.isActive ? "activated" : "deactivated"}`,
      data: promo,
    });
  } catch (error) {
    console.error("Error toggling promo status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle promo status",
    });
  }
};
